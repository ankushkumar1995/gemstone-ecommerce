import "server-only";

/**
 * Waitlist: when an astrologer is busy, customers line up instead of being refused.
 *
 *   waiting ──astrologer free──▶ offered (customer has `offerSec` to take it)
 *      │                            ├─ accept ▶ accepted (a normal chat request is made; the astrologer accepts as usual)
 *      │                            └─ timeout ▶ expired (next person is offered)
 *      └─ leave / removed by astrologer / cancelled (astrologer offline too long, etc.)
 *
 * Fairness: while anyone is waiting or offered, new chat requests to that
 * astrologer are sent to the waitlist (reason QUEUE). The offered customer's
 * request goes through (requestId `wl-<entryId>`).
 * One open entry per customer (unique `openCustomer`), so nobody holds places
 * in several lines at once.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { astroSettingsService } from "@/modules/astro-settings";
import { astrologerService, isOnline } from "@/modules/astrologers";

type Doc = Record<string, unknown> & { _id: unknown };
type AnyDoc = Record<string, unknown>;

const EntrySchema = new Schema(
  {
    astrologerId: { type: String, required: true },
    astrologer: Schema.Types.Mixed,
    customerId: { type: String, required: true },
    customerName: { type: String, default: "Customer" },
    question: { type: String, default: "" },
    status: { type: String, required: true },
    openCustomer: { type: String, default: null },
    createdAt: { type: String, required: true },
    offeredAt: { type: String, default: null },
    offerExpiresAt: { type: String, default: null },
    endedAt: { type: String, default: null },
    endReason: { type: String, default: null },
    sessionId: { type: String, default: null },
    /** Joined from this live ("1-to-1 chat" on the live screen). */
    fromLiveId: { type: String, default: null },
  },
  { collection: "consult_waitlist", versionKey: false },
);
EntrySchema.index({ openCustomer: 1 }, { unique: true, partialFilterExpression: { openCustomer: { $type: "string" } } });
EntrySchema.index({ astrologerId: 1, status: 1, createdAt: 1 });
const PrefSchema = new Schema({ astrologerId: { type: String, required: true, unique: true }, open: { type: Boolean, default: true } }, { collection: "consult_waitlist_prefs", versionKey: false });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["ConsultWaitlist", "ConsultWaitlistPref"]) if (models[n]) deleteModel(n);
}
const WaitlistModel: Model<AnyDoc> = (models.ConsultWaitlist as Model<AnyDoc>) ?? model<AnyDoc>("ConsultWaitlist", EntrySchema);
const PrefModel: Model<AnyDoc> = (models.ConsultWaitlistPref as Model<AnyDoc>) ?? model<AnyDoc>("ConsultWaitlistPref", PrefSchema);

async function db() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return { WaitlistModel, PrefModel };
}

const OPEN = ["waiting", "offered"];
const nowIso = () => new Date().toISOString();
export type WaitStatus = "waiting" | "offered" | "accepted" | "expired" | "left" | "removed" | "cancelled";

export interface WaitEntryView {
  id: string;
  status: WaitStatus;
  astrologer: { id: string; name: string; slug: string; photo: string | null };
  customerName: string;
  question: string;
  /** 1 = next. Null once offered or closed. */
  position: number | null;
  /** Rough wait in minutes. */
  etaMin: number | null;
  offerExpiresAt: string | null;
  sessionId: string | null;
  endReason: string | null;
  /** Joined from a live. */
  fromLiveId: string | null;
  createdAt: string;
  serverNow: string;
}

function isDup(e: unknown, field: string) {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

async function avgMinutes(astrologerId: string): Promise<number> {
  const a = await astrologerService.getInternal(astrologerId);
  const s = a?.stats;
  const avg = s && s.totalSessions > 0 ? s.totalMinutes / s.totalSessions : 10;
  return Math.min(30, Math.max(5, Math.round(avg)));
}

async function toView(d: Doc): Promise<WaitEntryView> {
  const { WaitlistModel: W } = await db();
  let position: number | null = null;
  let etaMin: number | null = null;
  if (d.status === "waiting") {
    position = (await W.countDocuments({ astrologerId: d.astrologerId, status: { $in: OPEN }, createdAt: { $lt: d.createdAt as string } })) + 1;
    etaMin = position * (await avgMinutes(d.astrologerId as string));
  }
  const a = (d.astrologer as { name: string; slug: string; photo: string | null }) ?? { name: "Astrologer", slug: "", photo: null };
  return {
    id: String(d._id), status: d.status as WaitStatus, astrologer: { id: d.astrologerId as string, ...a }, customerName: d.customerName as string,
    question: (d.question as string) ?? "", position, etaMin, offerExpiresAt: (d.offerExpiresAt as string) ?? null, sessionId: (d.sessionId as string) ?? null,
    endReason: (d.endReason as string) ?? null, fromLiveId: (d.fromLiveId as string) ?? null, createdAt: d.createdAt as string, serverNow: nowIso(),
  };
}

async function close(id: string, from: string[], status: WaitStatus, reason: string, extra: Record<string, unknown> = {}) {
  const { WaitlistModel: W } = await db();
  return W.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: { status, openCustomer: null, endedAt: nowIso(), endReason: reason, ...extra } }, { new: true }).lean<Doc>();
}

async function astroBusy(astrologerId: string): Promise<boolean> {
  const { ConsultSessionModel } = await import("./consult.model");
  return Boolean(await ConsultSessionModel.exists({ openAstro: astrologerId }));
}

/**
 * Give the next person their turn if the astrologer is free. Expires an
 * offer that ran out first. Safe to call often (no-op when nothing to do).
 */
export async function offerNext(astrologerId: string): Promise<void> {
  const { WaitlistModel: W } = await db();
  const st = await astroSettingsService.get();
  const now = nowIso();
  // An offer that timed out: close it.
  const stale = await W.find({ astrologerId, status: "offered", offerExpiresAt: { $lte: now } }).select("_id").lean<Doc[]>();
  for (const s of stale) await close(String(s._id), ["offered"], "expired", "Did not take the turn in time");
  if (await W.exists({ astrologerId, status: "offered" })) return;
  if (await astroBusy(astrologerId)) return;
  const a = await astrologerService.getInternal(astrologerId);
  if (!a || !isOnline(a, st) || !a.presence.channels.chat) return;
  try {
    const { liveOf } = await import("@/modules/live");
    if (await liveOf(astrologerId)) return;
  } catch { /* no live module: ignore */ }
  const next = await W.findOne({ astrologerId, status: "waiting" }).sort({ createdAt: 1 }).lean<Doc>();
  if (!next) return;
  await W.updateOne({ _id: next._id, status: "waiting" }, { $set: { status: "offered", offeredAt: now, offerExpiresAt: new Date(Date.now() + st.waitlist.offerSec * 1000).toISOString() } });
}

/** Sweep every astrologer with an open line (offers, timeouts). */
export async function sweepWaitlists(): Promise<{ astrologers: number }> {
  const { WaitlistModel: W } = await db();
  const ids = (await W.distinct("astrologerId", { status: { $in: OPEN } })) as string[];
  for (const id of ids.slice(0, 300)) await offerNext(id).catch(() => undefined);
  return { astrologers: ids.length };
}

/** For chat requests: is this request allowed past the line? */
export async function queueGate(astrologerId: string, customerId: string, requestId: string): Promise<{ allowed: true; entryId?: string } | { allowed: false; waiting: number }> {
  const { WaitlistModel: W } = await db();
  await offerNext(astrologerId).catch(() => undefined);
  const open = await W.find({ astrologerId, status: { $in: OPEN } }).select("_id customerId status").lean<Doc[]>();
  if (!open.length) return { allowed: true };
  const mine = open.find((e) => e.customerId === customerId && e.status === "offered");
  if (mine && requestId === `wl-${String(mine._id)}`) return { allowed: true, entryId: String(mine._id) };
  return { allowed: false, waiting: open.length };
}

export const waitlistService = {
  async join(customerId: string, astrologerId: string, question: string, opts: { fromLiveId?: string | null } = {}): Promise<Result<WaitEntryView>> {
    const st = await astroSettingsService.get();
    if (!st.waitlist.enabled) return fail(AppErrors.forbidden("The waitlist is not available right now."));
    const { WaitlistModel: W, PrefModel: P } = await db();
    const existing = await W.findOne({ openCustomer: customerId }).lean<Doc>();
    if (existing) {
      if (existing.astrologerId === astrologerId) return ok(await toView(existing));
      return fail(AppErrors.conflict(`You are already waiting for ${(existing.astrologer as { name?: string })?.name ?? "another astrologer"}. Leave that line first.`, { reason: "IN_OTHER_LINE", entryId: String(existing._id) }));
    }
    const a = await astrologerService.getInternal(astrologerId);
    if (!a || a.status !== "approved" || a.hidden) return fail(AppErrors.notFound("This astrologer is not available"));
    if (!isOnline(a, st) || !a.presence.channels.chat) return fail(AppErrors.validation(`${a.displayName} is offline now, so the waitlist is closed.`, { reason: "OFFLINE" }));
    const pref = await P.findOne({ astrologerId }).lean<Doc>();
    if (pref && pref.open === false) return fail(AppErrors.validation(`${a.displayName} is not taking a waitlist right now.`, { reason: "WAITLIST_CLOSED" }));
    const { ConsultSessionModel, ConsultBlockModel } = await import("./consult.model");
    if (await ConsultSessionModel.exists({ openCustomer: customerId })) return fail(AppErrors.conflict("Finish your current chat before joining a waitlist.", { reason: "OPEN_CHAT" }));
    if (await ConsultBlockModel.exists({ astrologerId, customerId })) return fail(AppErrors.validation(`${a.displayName} is not taking chats right now.`, { reason: "OFFLINE" }));
    const size = await W.countDocuments({ astrologerId, status: { $in: OPEN } });
    if (size >= st.waitlist.maxSize) return fail(AppErrors.validation(`The waitlist for ${a.displayName} is full. Please try another astrologer.`, { reason: "WAITLIST_FULL" }));
    // Same balance rule as starting a chat.
    const need = st.minStartMinutes * Math.round(a.rates.chat * 100);
    const { walletService } = await import("@/modules/wallets");
    const b = await walletService.balance(customerId);
    if (b.cashPaise + b.promoPaise < need) return fail(AppErrors.validation(`You need at least ₹${need / 100} (${st.minStartMinutes} minutes) in your wallet to wait for this chat.`, { reason: "LOW_BALANCE", needPaise: need, balancePaise: b.cashPaise + b.promoPaise }));
    const { customerService } = await import("@/modules/customers");
    const c = await customerService.getById(customerId);
    const { maskContacts } = await import("./consult.mask");
    // Lead from a live: only counted for this astrologer's own live, on now or ended in the past 2 hours.
    let fromLive: string | null = null;
    if (opts.fromLiveId && /^[a-f0-9]{24}$/i.test(opts.fromLiveId)) {
      const { LiveSessionModel } = await import("@/modules/live/live.model");
      const l = await LiveSessionModel.findOne({ _id: opts.fromLiveId, astrologerId }).select("status endedAt").lean<Doc>();
      if (l && (l.status === "live" || (l.status === "ended" && Date.parse(l.endedAt as string) > Date.now() - 2 * 3600_000))) fromLive = opts.fromLiveId;
    }
    try {
      const d = await W.create({
        astrologerId, astrologer: { name: a.displayName, slug: a.slug, photo: a.photo ?? null }, customerId,
        customerName: c.ok ? (c.value.name || "Customer").split(" ")[0].slice(0, 40) : "Customer",
        question: maskContacts(question.trim().slice(0, 300)).text, status: "waiting", openCustomer: customerId, createdAt: nowIso(),
        fromLiveId: fromLive,
      });
      if (fromLive) {
        const { LiveSessionModel } = await import("@/modules/live/live.model");
        await LiveSessionModel.updateOne({ _id: fromLive }, { $inc: { chatLeads: 1, version: 1 } }).catch(() => undefined);
      }
      const { cache } = await import("@/core/cache");
      cache.del(`live:pc:${astrologerId}`);
      await offerNext(astrologerId).catch(() => undefined);
      return ok(await toView((await W.findById(d._id).lean<Doc>()) ?? (d.toObject() as Doc)));
    } catch (e) {
      if (isDup(e, "openCustomer")) { const x = await W.findOne({ openCustomer: customerId }).lean<Doc>(); if (x) return ok(await toView(x)); }
      throw e;
    }
  },

  /** The customer's open place (or the last closed one in the past 10 minutes, so the app can explain it). */
  async mine(customerId: string): Promise<WaitEntryView | null> {
    const { WaitlistModel: W } = await db();
    let d = await W.findOne({ openCustomer: customerId }).lean<Doc>();
    if (d) { await offerNext(d.astrologerId as string).catch(() => undefined); d = (await W.findById(d._id).lean<Doc>()) ?? d; }
    if (!d) d = await W.findOne({ customerId, endedAt: { $gte: new Date(Date.now() - 10 * 60_000).toISOString() }, status: { $in: ["expired", "removed", "cancelled"] } }).sort({ endedAt: -1 }).lean<Doc>();
    return d ? toView(d) : null;
  },

  async leave(customerId: string, id: string): Promise<Result<WaitEntryView>> {
    const { WaitlistModel: W } = await db();
    const d = await W.findOne({ _id: id, customerId }).lean<Doc>();
    if (!d) return fail(AppErrors.notFound("Not found"));
    const done = (await close(id, OPEN, "left", "Left the line")) ?? d;
    await offerNext(d.astrologerId as string).catch(() => undefined);
    return ok(await toView(done));
  },

  /** Take the turn: makes the chat request (the astrologer then accepts as usual). */
  async accept(customerId: string, id: string): Promise<Result<{ entry: WaitEntryView; sessionId: string }>> {
    const { WaitlistModel: W } = await db();
    const d = await W.findOne({ _id: id, customerId }).lean<Doc>();
    if (!d) return fail(AppErrors.notFound("Not found"));
    if (d.status === "accepted" && d.sessionId) return ok({ entry: await toView(d), sessionId: d.sessionId as string });
    if (d.status !== "offered" || Date.parse(d.offerExpiresAt as string) <= Date.now()) {
      await offerNext(d.astrologerId as string).catch(() => undefined);
      return fail(AppErrors.validation("Your turn has passed. You can join the line again.", { reason: "TURN_PASSED" }));
    }
    const { consultService } = await import("./consult.service");
    const r = await consultService.request(customerId, { astrologerId: d.astrologerId as string, requestId: `wl-${id}`, question: (d.question as string) || undefined });
    if (!r.ok) {
      await close(id, ["offered"], "removed", r.error.message);
      await offerNext(d.astrologerId as string).catch(() => undefined);
      return fail(r.error);
    }
    const done = (await close(id, ["offered"], "accepted", "Took the turn", { sessionId: r.value.id })) ?? d;
    return ok({ entry: await toView(done), sessionId: r.value.id });
  },

  /* ---------- astrologer ---------- */

  async forAstrologer(astrologerId: string): Promise<{ open: boolean; entries: WaitEntryView[]; enabled: boolean; maxSize: number }> {
    const st = await astroSettingsService.get();
    const { WaitlistModel: W, PrefModel: P } = await db();
    await offerNext(astrologerId).catch(() => undefined);
    const rows = await W.find({ astrologerId, status: { $in: OPEN } }).sort({ createdAt: 1 }).limit(100).lean<Doc[]>();
    const pref = await P.findOne({ astrologerId }).lean<Doc>();
    return { open: pref ? pref.open !== false : true, entries: await Promise.all(rows.map(toView)), enabled: st.waitlist.enabled, maxSize: st.waitlist.maxSize };
  },

  async setOpen(astrologerId: string, open: boolean): Promise<void> {
    const { PrefModel: P } = await db();
    await P.updateOne({ astrologerId }, { $set: { open } }, { upsert: true });
  },

  async remove(astrologerId: string, id: string): Promise<Result<{ ok: true }>> {
    const done = await close(id, OPEN, "removed", "Removed by the astrologer");
    if (!done || done.astrologerId !== astrologerId) return fail(AppErrors.notFound("Not found"));
    await offerNext(astrologerId).catch(() => undefined);
    return ok({ ok: true });
  },

  /** Astrologer went offline: everyone in the line is told (no charge was ever taken). */
  async closeAll(astrologerId: string, reason: string): Promise<void> {
    const { WaitlistModel: W } = await db();
    await W.updateMany({ astrologerId, status: { $in: OPEN } }, { $set: { status: "cancelled", openCustomer: null, endedAt: nowIso(), endReason: reason } });
  },

  /** Is the astrologer taking a waitlist (their own on/off switch)? */
  async isOpen(astrologerId: string): Promise<boolean> {
    const { PrefModel: P } = await db();
    const pref = await P.findOne({ astrologerId }).lean<Doc>();
    return pref ? pref.open !== false : true;
  },

  /** Take one customer out of this astrologer's line (blocked). */
  async removeCustomer(astrologerId: string, customerId: string, reason: string): Promise<void> {
    const { WaitlistModel: W } = await db();
    const d = await W.findOne({ astrologerId, customerId, status: { $in: OPEN } }).select("_id").lean<Doc>();
    if (!d) return;
    await close(String(d._id), OPEN, "removed", reason);
    await offerNext(astrologerId).catch(() => undefined);
  },

  async count(astrologerId: string): Promise<number> {
    const { WaitlistModel: W } = await db();
    return W.countDocuments({ astrologerId, status: { $in: OPEN } });
  },
};
