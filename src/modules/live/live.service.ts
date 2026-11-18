import "server-only";

/**
 * Live engine. See live.types.ts for the lifecycle.
 *
 * Safety rules
 *   • One live per astrologer (unique `openAstro`), and never while they are in
 *     a chat; chat requests are refused while they are live.
 *   • Every state change is a compare-and-set on `status`.
 *   • Gifts: the wallet charge is idempotent on `live:<id>:gift:<clientId>`
 *     and the counters move in the same atomic update that creates the gift
 *     event, so a retry can never charge or count twice. If the live ended
 *     between the charge and the event, the money goes straight back.
 *   • Comments are masked (phone, email, UPI, links), rate limited per viewer
 *     (slow mode) and can be hidden / pinned / muted by the astrologer.
 *   • The sweep ends a live whose astrologer stopped polling, and every live
 *     at the time limit.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { cache } from "@/core/cache";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import { astrologerService } from "@/modules/astrologers";
import { maskContacts } from "@/modules/consultations/consult.mask";
import { liveHlsUrl, liveVideoConfigured, publisherToken, startHlsEgress, stopEgress } from "@/core/livekit";
import { LIVE_TAGS, type LiveEndReason, type LiveEvent, type LiveEventKind, type LiveGift, type LiveQueueItem, type LiveSession, type LiveStatus } from "./live.types";
import { check as filterText, isRepeat, norm } from "./live.filter";

type Doc = Record<string, unknown> & { _id: unknown };
export type LiveWho = { customerId?: string; astrologerId?: string };
export type LiveRole = "astrologer" | "customer" | "guest";

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./live.model");
}

/** A viewer counts as watching this long after their last poll. */
const VIEWER_MS = 35_000;
/** The astrologer must poll at least this often or the live ends. */
const ASTRO_GONE_MS = 90_000;
const nowIso = () => new Date().toISOString();
const isId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

const END_TEXT: Record<LiveEndReason, string> = {
  astrologer: "The live has ended. Thank you for joining.",
  time_limit: "The live reached its time limit and has ended.",
  astrologer_left: "The astrologer was disconnected. The live has ended.",
  admin: "This live was ended by AstroUnkle support.",
};

function out(d: Doc | null): LiveSession | null {
  if (!d) return null;
  const { _id, createdAt, ...rest } = d;
  return {
    ...(rest as unknown as Omit<LiveSession, "id" | "createdAt">),
    id: String(_id),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? nowIso()),
    muted: (d.muted as string[]) ?? [],
    hiddenSeqs: (d.hiddenSeqs as number[]) ?? [],
    superPin: (d.superPin as LiveSession["superPin"]) ?? null,
    superChatCount: (d.superChatCount as number) ?? 0,
    superChatPaise: (d.superChatPaise as number) ?? 0,
    reminderCount: (d.reminderCount as number) ?? 0,
    tags: (d.tags as string[]) ?? [],
    languages: (d.languages as string[]) ?? [],
    featured: d.featured === true,
    featuredAt: (d.featuredAt as string) ?? null,
    chatLeads: (d.chatLeads as number) ?? 0,
  };
}

/** Customer blocked by this astrologer for good (chats, waitlist, every live). */
async function isBlocked(astrologerId: string, customerId: string): Promise<boolean> {
  const { ConsultBlockModel } = await import("@/modules/consultations/consult.model");
  return Boolean(await ConsultBlockModel.exists({ astrologerId, customerId }));
}

/** App language → astrologer language (Hinglish and Hindi both match Hindi). */
function langKey(l: string): string {
  const x = l.trim().toLowerCase();
  if (x === "hinglish" || x === "hi" || x === "hindi") return "hindi";
  if (x === "en" || x === "english") return "english";
  return x;
}

function evOut(d: Doc, me?: string): LiveEvent {
  return {
    seq: d.seq as number, kind: d.kind as LiveEventKind, by: d.by as LiveEvent["by"], name: (d.name as string) ?? "", text: (d.text as string) ?? "",
    ...(d.gift ? { gift: d.gift as LiveEvent["gift"] } : {}), at: d.at as string,
    ...(me && d.customerId === me ? { mine: true } : {}),
  };
}

const qOut = (d: Doc): LiveQueueItem => ({
  id: String(d._id), name: d.name as string, question: d.question as string, status: d.status as LiveQueueItem["status"], createdAt: d.createdAt as string,
  paidPaise: (d.paidPaise as number) ?? 0, paidState: ((d.paidState as LiveQueueItem["paidState"]) ?? "none"),
});
/** Line order: Super Chats first (higher amount first), then by `rankAt` (arrival, or payment time for an upgrade). */
const QUEUE_SORT = { paidPaise: -1, rankAt: 1 } as const;

/**
 * Settle a Super Chat exactly once (compare-and-set on paidState "held").
 *   earned   → the astrologer answered it: ledger + live stats (commission applies)
 *   refunded → skipped, muted, left the line, or the live ended first: money back to the wallet
 */
async function settleSuper(q: Doc, outcome: "earned" | "refunded", s: LiveSession, actor: string): Promise<void> {
  if (!q || (q.paidPaise as number) <= 0) return;
  const { LiveQueueModel, LiveSessionModel } = await M();
  const r = await LiveQueueModel.updateOne({ _id: q._id, paidState: "held" }, { $set: { paidState: outcome, updatedAt: nowIso() } });
  if (r.modifiedCount === 0) return;
  const paid = q.paidPaise as number;
  if (outcome === "earned") {
    const earning = Math.floor((paid * (100 - s.commissionPct)) / 100);
    await LiveSessionModel.updateOne({ _id: s.id }, { $inc: { superChatPaise: paid, earningPaise: earning } });
    try {
      const { earningsLedger } = await import("@/modules/earnings");
      await earningsLedger.superChat({ queueId: String(q._id), liveId: s.id, liveNumber: s.liveNumber, astrologerId: s.astrologerId, pricePaise: paid, earningPaise: earning, from: q.name as string });
    } catch { /* reconciled later */ }
    return;
  }
  const { walletService } = await import("@/modules/wallets");
  const split = (q.paidSplit as { cashPaise: number; promoPaise: number } | null) ?? { cashPaise: paid, promoPaise: 0 };
  await walletService.refund(q.customerId as string, `${q.paidKey}:refund`, split, s.id, `Super Chat refunded: question not answered on ${s.astrologer.name}'s live`, actor).catch(() => undefined);
}

async function get(id: string): Promise<LiveSession | null> {
  if (!isId(id)) return null;
  const { LiveSessionModel } = await M();
  return out(await LiveSessionModel.findById(id).lean<Doc>());
}

async function cas(id: string, from: LiveStatus[], set: Record<string, unknown>): Promise<LiveSession | null> {
  const { LiveSessionModel } = await M();
  return out(await LiveSessionModel.findOneAndUpdate({ _id: id, status: { $in: from } }, { $set: set, $inc: { version: 1 } }, { new: true }).lean<Doc>());
}

async function bump(id: string, update: Record<string, unknown>, filter: Record<string, unknown> = {}): Promise<LiveSession | null> {
  const { LiveSessionModel } = await M();
  const u = { ...update, $inc: { ...((update.$inc as Record<string, number>) ?? {}), version: 1 } };
  return out(await LiveSessionModel.findOneAndUpdate({ _id: id, ...filter }, u, { new: true }).lean<Doc>());
}

/** Mute a viewer on this live: no more comments or questions; their waiting question leaves the line (Super Chat refunded). */
async function muteViewer(s: LiveSession, customerId: string, actor: string, extra: Record<string, unknown> = {}): Promise<void> {
  const { LiveQueueModel } = await M();
  await bump(s.id, { ...extra, $addToSet: { muted: customerId } });
  const theirs = await LiveQueueModel.findOneAndUpdate({ openKey: `${s.id}:${customerId}`, status: "waiting" }, { $set: { status: "skipped", openKey: null, updatedAt: nowIso() } }, { new: true }).lean<Doc>();
  if (theirs) await settleSuper(theirs, "refunded", s, actor);
}

function isDup(e: unknown, field: string) {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

/**
 * Append an event. The counter bump and the extra counters (`inc`) happen in
 * one atomic update, only while the live is on (unless `anyStatus`).
 */
async function addEvent(
  liveId: string,
  e: { kind: LiveEventKind; by: LiveEvent["by"]; name: string; text: string; customerId?: string | null; gift?: LiveEvent["gift"]; clientId?: string; shadow?: boolean },
  opts: { inc?: Record<string, number>; anyStatus?: boolean } = {},
): Promise<{ event: Doc; live: LiveSession } | null> {
  const { LiveSessionModel, LiveEventModel } = await M();
  if (e.clientId) {
    const dup = await LiveEventModel.findOne({ liveId, clientId: e.clientId }).lean<Doc>();
    if (dup) { const l = await get(liveId); return l ? { event: dup, live: l } : null; }
  }
  const bumped = out(await LiveSessionModel.findOneAndUpdate(
    { _id: liveId, ...(opts.anyStatus ? {} : { status: "live" }) },
    { $inc: { seq: 1, ...(opts.inc ?? {}) } },
    { new: true },
  ).lean<Doc>());
  if (!bumped) return null;
  try {
    const d = await LiveEventModel.create({ liveId, seq: bumped.seq, kind: e.kind, by: e.by, name: e.name, text: e.text, customerId: e.customerId ?? null, gift: e.gift ?? null, ...(e.clientId ? { clientId: e.clientId } : {}), ...(e.shadow ? { shadow: true } : {}), at: nowIso() });
    return { event: d.toObject() as Doc, live: bumped };
  } catch (err) {
    if (e.clientId && isDup(err, "clientId")) {
      // A parallel retry won the race. Undo our counters (the seq gap is harmless).
      if (opts.inc && Object.keys(opts.inc).length) await LiveSessionModel.updateOne({ _id: liveId }, { $inc: Object.fromEntries(Object.entries(opts.inc).map(([k, v]) => [k, -v])) });
      const x = await LiveEventModel.findOne({ liveId, clientId: e.clientId }).lean<Doc>();
      if (x) return { event: x, live: bumped };
    }
    throw err;
  }
}

async function customerName(customerId: string): Promise<string> {
  const key = `live:cname:${customerId}`;
  const hit = cache.get<string>(key);
  if (hit) return hit;
  try {
    const { customerService } = await import("@/modules/customers");
    const c = await customerService.getById(customerId);
    const n = c.ok ? (c.value.name || "Guest").trim().split(/\s+/)[0].slice(0, 24) || "Guest" : "Guest";
    cache.set(key, n, 600);
    return n;
  } catch { return "Guest"; }
}

/* ---------------- viewers ---------------- */

const touched = new Map<string, number>();

/** Keep the viewer row fresh (throttled). First visit: join line + unique count. */
async function touchViewer(s: LiveSession, customerId: string): Promise<void> {
  if (s.status !== "live") return;
  const k = `${s.id}:${customerId}`;
  const last = touched.get(k) ?? 0;
  if (Date.now() - last < 10_000) return;
  touched.set(k, Date.now());
  if (touched.size > 20_000) touched.clear();
  const { LiveViewerModel, LiveSessionModel } = await M();
  const at = nowIso();
  const r = await LiveViewerModel.updateOne({ liveId: s.id, customerId }, { $set: { lastSeen: at } });
  if (r.matchedCount > 0) return;
  const name = await customerName(customerId);
  try {
    await LiveViewerModel.create({ liveId: s.id, customerId, name, joinedAt: at, lastSeen: at });
  } catch (e) {
    if (isDup(e, "liveId") || isDup(e, "customerId")) return;
    throw e;
  }
  await LiveSessionModel.updateOne({ _id: s.id }, { $inc: { uniqueViewers: 1 } });
  cache.del(`live:viewers:${s.id}`); // a new viewer shows in the count at once
  await addEvent(s.id, { kind: "join", by: "system", name, text: "joined", customerId });
}

async function viewersOf(s: LiveSession): Promise<number> {
  if (s.status !== "live") return 0;
  const key = `live:viewers:${s.id}`;
  const hit = cache.get<number>(key);
  if (hit !== undefined && hit !== null) return hit;
  const { LiveViewerModel, LiveSessionModel } = await M();
  const n = await LiveViewerModel.countDocuments({ liveId: s.id, lastSeen: { $gte: new Date(Date.now() - VIEWER_MS).toISOString() } });
  cache.set(key, n, 5);
  if (n > s.peakViewers) await LiveSessionModel.updateOne({ _id: s.id, peakViewers: { $lt: n } }, { $set: { peakViewers: n } });
  // Graph point about once a minute (atomic: only one poller wins each minute).
  const at = nowIso();
  await LiveSessionModel.updateOne(
    { _id: s.id, status: "live", $or: [{ lastSampleAt: null }, { lastSampleAt: { $lte: new Date(Date.now() - 55_000).toISOString() } }] },
    { $set: { lastSampleAt: at }, $push: { viewerSamples: { $each: [{ at, n }], $slice: -1000 } } },
  ).catch(() => undefined);
  return n;
}

async function beat(s: LiveSession): Promise<LiveSession> {
  if (s.status !== "live") return s;
  const last = s.lastBeatAt ? Date.parse(s.lastBeatAt) : 0;
  if (Date.now() - last < 5_000) return s;
  const { LiveSessionModel } = await M();
  // Presence is not a "change" for long-poll purposes: no version bump.
  const d = await LiveSessionModel.findOneAndUpdate({ _id: s.id }, { $set: { lastBeatAt: nowIso() } }, { new: true }).lean<Doc>();
  return out(d) ?? s;
}

/* ---------------- end + sweep ---------------- */

async function endLive(s: LiveSession, reason: LiveEndReason, actor: string, at = nowIso()): Promise<LiveSession | null> {
  if (s.status !== "live") return s;
  const done = await cas(s.id, ["live"], { status: "ended", endReason: reason, endedAt: at, openAstro: null, answering: null });
  if (!done) return get(s.id);
  // Stop the video recorder (best effort: LiveKit also stops it when the room empties).
  if (s.stream?.egressId && liveVideoConfigured()) await stopEgress(s.stream.egressId).catch(() => undefined);
  const { LiveQueueModel } = await M();
  // Super Chats: the one being answered is kept; the ones still waiting go back to the customers.
  const paid = await LiveQueueModel.find({ liveId: s.id, status: { $in: ["waiting", "answering"] }, paidState: "held" }).lean<Doc[]>();
  for (const q of paid) await settleSuper(q, q.status === "answering" ? "earned" : "refunded", done, actor).catch(() => undefined);
  await LiveQueueModel.updateMany({ liveId: s.id, status: "answering" }, { $set: { status: "answered", openKey: null, updatedAt: nowIso() } });
  await LiveQueueModel.updateMany({ liveId: s.id, status: "waiting" }, { $set: { status: "left", openKey: null, updatedAt: nowIso() } });
  await addEvent(s.id, { kind: "system", by: "system", name: "", text: END_TEXT[reason] }, { anyStatus: true });
  cache.del(`live:viewers:${s.id}`);
  cache.del(`live:pc:${s.astrologerId}`);
  // Viewers who lined up for a 1-to-1 chat during the live: the first one gets their turn now.
  try {
    const { offerNext } = await import("@/modules/consultations/consult.waitlist");
    await offerNext(s.astrologerId);
  } catch { /* the waitlist sweep will offer it */ }
  const mins = done.startedAt ? Math.max(0, Math.round((Date.parse(at) - Date.parse(done.startedAt)) / 60000)) : 0;
  await auditService.record({
    action: "status", entity: "live", entityId: done.id, entityLabel: done.liveNumber,
    summary: `Live ${done.liveNumber} by ${done.astrologer.name} ended (${reason}) · ${mins} min · ${done.uniqueViewers} viewers · gifts ₹${done.giftsPaise / 100}`, actor,
  }).catch(() => undefined);
  return (await get(s.id)) ?? done;
}

async function sweepOne(s: LiveSession): Promise<LiveSession> {
  const now = Date.now();
  if (s.status === "scheduled" && s.scheduledAt && Date.parse(s.scheduledAt) + 2 * 3600_000 < now) {
    return (await cas(s.id, ["scheduled"], { status: "cancelled", endedAt: nowIso() })) ?? s;
  }
  if (s.status !== "live") return s;
  const st = await astroSettingsService.get();
  const started = Date.parse(s.startedAt ?? s.createdAt);
  if (started + st.live.maxMinutes * 60_000 <= now) return (await endLive(s, "time_limit", "System", new Date(started + st.live.maxMinutes * 60_000).toISOString())) ?? s;
  const lastBeat = s.lastBeatAt ? Date.parse(s.lastBeatAt) : started;
  if (now - lastBeat > ASTRO_GONE_MS) return (await endLive(s, "astrologer_left", "System", new Date(lastBeat + 30_000).toISOString())) ?? s;
  return s;
}

export async function sweepLives(): Promise<{ checked: number }> {
  const { LiveSessionModel } = await M();
  const rows = await LiveSessionModel.find({ status: { $in: ["live", "scheduled"] } }).limit(300).lean<Doc[]>();
  for (const r of rows) { const s = out(r); if (s) await sweepOne(s).catch(() => undefined); }
  return { checked: rows.length };
}

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
export function maybeSweepLives(everyMs = 15_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  sweeping = sweepLives().catch(() => undefined).finally(() => { sweeping = null; });
}

/** The astrologer's live right now, small (panel banner). */
export async function currentLiveOf(astrologerId: string): Promise<{ id: string; title: string; startedAt: string | null; version: number; seq: number } | null> {
  const { LiveSessionModel } = await M();
  const d = await LiveSessionModel.findOne({ openAstro: astrologerId }).select("_id title startedAt version seq").lean<Doc>();
  return d ? { id: String(d._id), title: d.title as string, startedAt: (d.startedAt as string) ?? null, version: d.version as number, seq: d.seq as number } : null;
}

/** Keep the astrologer's live alive from any panel page (the inbox poll calls this). */
export async function beatLiveOf(astrologerId: string): Promise<void> {
  const { LiveSessionModel } = await M();
  await LiveSessionModel.updateOne({ openAstro: astrologerId, status: "live", lastBeatAt: { $lt: new Date(Date.now() - 5_000).toISOString() } }, { $set: { lastBeatAt: nowIso() } });
}

/** End the astrologer's live, if any (they went offline). */
export async function endLiveOf(astrologerId: string, actor = "Astrologer"): Promise<void> {
  const id = await liveOf(astrologerId);
  if (!id) return;
  const s = await get(id);
  if (s) await endLive(s, "astrologer", actor);
}

/* ---------------- follows + reminders ---------------- */

export interface FollowerRow { name: string; via: string; alerts: boolean; at: string }

export const followService = {
  /** Follow (idempotent). `via` = where the tap happened (profile, live, chat). */
  async follow(customerId: string, astrologerId: string, via: string): Promise<Result<{ following: true; followers: number }>> {
    const a = await astrologerService.getInternal(astrologerId);
    if (!a || a.status !== "approved" || a.hidden) return fail(AppErrors.notFound("This astrologer is not available"));
    const { AstroFollowModel } = await M();
    try {
      await AstroFollowModel.create({ customerId, astrologerId, name: await customerName(customerId), via: ["profile", "live", "chat", "card"].includes(via) ? via : "profile", alerts: true, at: nowIso() });
    } catch (e) {
      if (!isDup(e, "customerId") && !isDup(e, "astrologerId")) throw e;
    }
    cache.del(`follows:count:${astrologerId}`);
    return ok({ following: true, followers: await followerCount(astrologerId) });
  },
  async unfollow(customerId: string, astrologerId: string): Promise<{ following: false; followers: number }> {
    const { AstroFollowModel } = await M();
    await AstroFollowModel.deleteOne({ customerId, astrologerId });
    cache.del(`follows:count:${astrologerId}`);
    return { following: false, followers: await followerCount(astrologerId) };
  },
  async setAlerts(customerId: string, astrologerId: string, alerts: boolean): Promise<void> {
    const { AstroFollowModel } = await M();
    await AstroFollowModel.updateOne({ customerId, astrologerId }, { $set: { alerts } });
  },
  /** Ids I follow (with alert setting), newest first. */
  async mine(customerId: string): Promise<{ astrologerId: string; alerts: boolean; at: string }[]> {
    const { AstroFollowModel } = await M();
    return (await AstroFollowModel.find({ customerId }).sort({ at: -1 }).limit(500).lean<Doc[]>()).map((d) => ({ astrologerId: d.astrologerId as string, alerts: d.alerts !== false, at: d.at as string }));
  },
  count: followerCount,
  async isFollowing(customerId: string, astrologerId: string): Promise<boolean> {
    const { AstroFollowModel } = await M();
    return Boolean(await AstroFollowModel.exists({ customerId, astrologerId }));
  },
  /** Partner panel: followers (first name only), growth. */
  async forAstrologer(astrologerId: string, cursor?: string): Promise<{ total: number; last7: number; last30: number; alertsOn: number; items: FollowerRow[]; nextCursor: string | null }> {
    const { AstroFollowModel } = await M();
    const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const d30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [total, last7, last30, alertsOn] = await Promise.all([
      AstroFollowModel.countDocuments({ astrologerId }), AstroFollowModel.countDocuments({ astrologerId, at: { $gte: d7 } }),
      AstroFollowModel.countDocuments({ astrologerId, at: { $gte: d30 } }), AstroFollowModel.countDocuments({ astrologerId, alerts: { $ne: false } }),
    ]);
    const rows = await AstroFollowModel.find({ astrologerId, ...(cursor ? { at: { $lt: cursor } } : {}) }).sort({ at: -1 }).limit(51).lean<Doc[]>();
    const items = rows.slice(0, 50).map((r) => ({ name: (r.name as string) || "Customer", via: (r.via as string) ?? "profile", alerts: r.alerts !== false, at: r.at as string }));
    return { total, last7, last30, alertsOn, items, nextCursor: rows.length > 50 ? items[items.length - 1].at : null };
  },
};

export const reminderService = {
  /** Remind me / stop reminding (scheduled lives only). */
  async set(customerId: string, liveId: string, on: boolean): Promise<Result<{ reminded: boolean; reminderCount: number }>> {
    const s = await get(liveId);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    const { LiveReminderModel, LiveSessionModel } = await M();
    if (on) {
      if (s.status !== "scheduled") return fail(AppErrors.validation(s.status === "live" ? "This live has already started." : "This live is not coming up any more.", { reason: s.status === "live" ? "ALREADY_LIVE" : "NOT_SCHEDULED" }));
      try {
        await LiveReminderModel.create({ liveId, customerId, astrologerId: s.astrologerId, at: nowIso() });
        await LiveSessionModel.updateOne({ _id: liveId }, { $inc: { reminderCount: 1 } });
      } catch (e) {
        if (!isDup(e, "liveId") && !isDup(e, "customerId")) throw e;
      }
    } else {
      const r = await LiveReminderModel.deleteOne({ liveId, customerId });
      if (r.deletedCount) await LiveSessionModel.updateOne({ _id: liveId, reminderCount: { $gt: 0 } }, { $inc: { reminderCount: -1 } });
    }
    const after = await get(liveId);
    return ok({ reminded: on, reminderCount: after?.reminderCount ?? 0 });
  },
  async mine(customerId: string): Promise<string[]> {
    const { LiveReminderModel } = await M();
    return (await LiveReminderModel.find({ customerId }).sort({ at: -1 }).limit(200).lean<Doc[]>()).map((d) => d.liveId as string);
  },
};

/**
 * In-app live alerts for a customer: lives on right now from astrologers they
 * follow (alerts on) or lives they asked to be reminded about. The app shows a
 * banner for each new one and puts followed lives first in stories.
 */
export async function liveAlertsFor(customerId: string): Promise<{ live: (Omit<LiveCard, "why"> & { why: "following" | "reminder" })[]; followingIds: string[]; remindedIds: string[] }> {
  const [follows, reminded] = await Promise.all([followService.mine(customerId), reminderService.mine(customerId)]);
  const alertIds = new Set(follows.filter((f) => f.alerts).map((f) => f.astrologerId));
  const remindSet = new Set(reminded);
  const { LiveSessionModel } = await M();
  const rows = (await LiveSessionModel.find({ status: "live", $or: [{ astrologerId: { $in: [...alertIds] } }, { _id: { $in: reminded.filter(isId) } }] }).sort({ startedAt: -1 }).limit(20).lean<Doc[]>()).map(out).filter(Boolean) as LiveSession[];
  const live: (Omit<LiveCard, "why"> & { why: "following" | "reminder" })[] = [];
  for (const s of rows) {
    const x = await sweepOne(s);
    if (x.status === "live") live.push({ ...(await card(x)), why: remindSet.has(x.id) ? "reminder" : "following" });
  }
  return { live, followingIds: follows.map((f) => f.astrologerId), remindedIds: reminded };
}

/** Is this astrologer live right now? (used by chat requests) */
export async function liveOf(astrologerId: string): Promise<string | null> {
  const { LiveSessionModel } = await M();
  const d = await LiveSessionModel.findOne({ openAstro: astrologerId }).select("_id").lean<Doc>();
  return d ? String(d._id) : null;
}

/* ---------------- views ---------------- */

export interface LiveView {
  id: string; liveNumber: string; title: string; topic: string; status: LiveStatus;
  astrologer: { id: string; name: string; photo: string | null; slug: string };
  scheduledAt: string | null; startedAt: string | null; endedAt: string | null; endReason: LiveEndReason | null; endText: string | null;
  /** When the time limit ends it (null unless live). */
  endsAt: string | null;
  viewers: number; likes: number; commentCount: number; giftCount: number;
  pinned: LiveSession["pinned"]; answering: LiveSession["answering"];
  commentsOff: boolean; slowSec: number; queueOpen: boolean; queueCount: number;
  hiddenSeqs: number[];
  /** Camera on: HLS playlist for viewers (plays a few seconds behind). */
  stream: { provider: string; playbackUrl: string; startedAt: string } | null;
  /** Astrologer only: can this server stream video at all (LiveKit set up)? */
  videoAvailable: boolean;
  role: LiveRole;
  /** Latest Super Chat while its highlight is on (null after `until`). */
  superPin: LiveSession["superPin"];
  tags: string[];
  featured: boolean;
  /**
   * Viewers only: 1-to-1 chat with this astrologer after (or during) the live.
   * `available` = the astrologer takes chats and a waitlist now; `waiting` = people already in line.
   */
  privateChat: { rate: number; available: boolean; waiting: number } | null;
  /** Astrologer only. */
  stats: { giftsPaise: number; earningPaise: number; peakViewers: number; uniqueViewers: number; superChatCount: number; superChatPaise: number; reminderCount: number; followers: number; chatLeads: number } | null;
  version: number; seq: number; serverNow: string;
}

export interface LiveCard {
  id: string; title: string; topic: string; status: LiveStatus;
  astrologer: { id: string; name: string; photo: string | null; slug: string };
  scheduledAt: string | null; startedAt: string | null; viewers: number; likes: number;
  /** How many people asked to be reminded (scheduled lives). */
  reminderCount: number;
  tags: string[];
  featured: boolean;
  /** Why it is high in this viewer's feed. */
  why: "featured" | "following" | "language" | null;
}

/** Viewer-side settings shipped with the room (gifts, combos, Super Chat). */
export interface LiveConfig { giftCombos: number[]; bigGiftAt: number; superChat: { enabled: boolean; tiers: { price: number; pinSec: number }[] } }

async function queueCount(liveId: string): Promise<number> {
  const { LiveQueueModel } = await M();
  return LiveQueueModel.countDocuments({ liveId, status: "waiting" });
}

/** 1-to-1 chat offer shown to viewers (cached a few seconds: every viewer polls this). */
async function privateChatOf(s: LiveSession): Promise<LiveView["privateChat"]> {
  if (s.status === "cancelled") return null;
  const key = `live:pc:${s.astrologerId}`;
  const hit = cache.get<NonNullable<LiveView["privateChat"]>>(key);
  if (hit) return hit;
  try {
    const st = await astroSettingsService.get();
    const a = await astrologerService.getInternal(s.astrologerId);
    if (!a) return null;
    const { waitlistService } = await import("@/modules/consultations/consult.waitlist");
    const { isOnline } = await import("@/modules/astrologers");
    const available = st.waitlist.enabled && a.status === "approved" && !a.hidden && isOnline(a, st) && a.presence.channels.chat && (await waitlistService.isOpen(s.astrologerId));
    const pc = { rate: a.rates.chat, available, waiting: available ? await waitlistService.count(s.astrologerId) : 0 };
    cache.set(key, pc, 8);
    return pc;
  } catch { return null; }
}

async function view(s: LiveSession, role: LiveRole): Promise<LiveView> {
  const st = await astroSettingsService.get();
  return {
    id: s.id, liveNumber: s.liveNumber, title: s.title, topic: s.topic, status: s.status,
    astrologer: { id: s.astrologerId, ...s.astrologer },
    scheduledAt: s.scheduledAt, startedAt: s.startedAt, endedAt: s.endedAt, endReason: s.endReason, endText: s.endReason ? END_TEXT[s.endReason] : null,
    endsAt: s.status === "live" && s.startedAt ? new Date(Date.parse(s.startedAt) + st.live.maxMinutes * 60_000).toISOString() : null,
    viewers: await viewersOf(s), likes: s.likes, commentCount: s.commentCount, giftCount: s.giftCount,
    pinned: s.pinned, answering: s.answering,
    commentsOff: s.commentsOff, slowSec: s.slowSec, queueOpen: s.queueOpen, queueCount: s.status === "live" ? await queueCount(s.id) : 0,
    hiddenSeqs: s.hiddenSeqs.slice(-200),
    stream: s.status === "live" && s.stream ? { provider: s.stream.provider, playbackUrl: s.stream.playbackUrl, startedAt: s.stream.startedAt } : null,
    videoAvailable: role === "astrologer" && liveVideoConfigured(),
    role,
    superPin: s.status === "live" && s.superPin && Date.parse(s.superPin.until) > Date.now() && !s.hiddenSeqs.includes(s.superPin.seq) ? s.superPin : null,
    tags: s.tags, featured: s.featured,
    privateChat: role === "astrologer" ? null : await privateChatOf(s),
    stats: role === "astrologer" ? {
      giftsPaise: s.giftsPaise, earningPaise: s.earningPaise, peakViewers: s.peakViewers, uniqueViewers: s.uniqueViewers,
      superChatCount: s.superChatCount, superChatPaise: s.superChatPaise, reminderCount: s.reminderCount, followers: await followerCount(s.astrologerId),
      chatLeads: s.chatLeads,
    } : null,
    version: s.version, seq: s.seq, serverNow: nowIso(),
  };
}

async function card(s: LiveSession, why: LiveCard["why"] = null): Promise<LiveCard> {
  return {
    id: s.id, title: s.title, topic: s.topic, status: s.status, astrologer: { id: s.astrologerId, ...s.astrologer }, scheduledAt: s.scheduledAt, startedAt: s.startedAt,
    viewers: await viewersOf(s), likes: s.likes, reminderCount: s.reminderCount, tags: s.tags, featured: s.featured, why,
  };
}

async function followerCount(astrologerId: string): Promise<number> {
  const key = `follows:count:${astrologerId}`;
  const hit = cache.get<number>(key);
  if (hit !== undefined && hit !== null) return hit;
  const { AstroFollowModel } = await M();
  const n = await AstroFollowModel.countDocuments({ astrologerId });
  cache.set(key, n, 30);
  return n;
}

async function liveConfig(): Promise<LiveConfig> {
  const st = await astroSettingsService.get();
  return { giftCombos: st.live.giftCombos, bigGiftAt: st.live.bigGiftAt, superChat: st.live.superChat };
}

function roleOf(s: LiveSession, who: LiveWho): LiveRole {
  if (who.astrologerId && who.astrologerId === s.astrologerId) return "astrologer";
  return who.customerId ? "customer" : "guest";
}

export interface LiveMe {
  queue: { id: string; status: LiveQueueItem["status"]; position: number | null; question: string; paidPaise: number } | null;
  muted: boolean;
  nextCommentAt: string | null;
  /** Following this astrologer (live alerts). */
  following: boolean;
  /** Blocked by this astrologer for good: can watch, cannot comment, ask or gift. */
  blocked: boolean;
}

/** Place in line: everyone who paid more, plus everyone who paid the same and came earlier. */
async function positionOf(liveId: string, q: Doc): Promise<number> {
  const { LiveQueueModel } = await M();
  const paid = (q.paidPaise as number) ?? 0;
  return (await LiveQueueModel.countDocuments({
    liveId, status: "waiting",
    $or: [{ paidPaise: { $gt: paid } }, { paidPaise: paid, rankAt: { $lt: (q.rankAt ?? q.createdAt) as string } }],
  })) + 1;
}

async function meOf(s: LiveSession, customerId: string): Promise<LiveMe> {
  const { LiveQueueModel, LiveViewerModel, AstroFollowModel } = await M();
  const q = await LiveQueueModel.findOne({ openKey: `${s.id}:${customerId}` }).lean<Doc>();
  const position = q && q.status === "waiting" ? await positionOf(s.id, q) : null;
  const v = await LiveViewerModel.findOne({ liveId: s.id, customerId }).select("lastCommentAt").lean<Doc>();
  const lastC = v?.lastCommentAt ? Date.parse(v.lastCommentAt as string) : 0;
  return {
    queue: q ? { id: String(q._id), status: q.status as LiveQueueItem["status"], position, question: q.question as string, paidPaise: (q.paidPaise as number) ?? 0 } : null,
    muted: s.muted.includes(customerId),
    nextCommentAt: lastC && s.slowSec ? new Date(lastC + s.slowSec * 1000).toISOString() : null,
    following: Boolean(await AstroFollowModel.exists({ customerId, astrologerId: s.astrologerId })),
    blocked: await isBlocked(s.astrologerId, customerId),
  };
}

async function giftsList(): Promise<LiveGift[]> {
  return (await astroSettingsService.get()).live.gifts;
}

/* ============================================================ *
 * Public API
 * ============================================================ */

export const liveService = {
  /**
   * Lives on now and upcoming scheduled ones, ranked for this viewer:
   *   1. featured by the admin (latest pin first)
   *   2. astrologers the viewer follows
   *   3. astrologers who speak the viewer's language (Hinglish counts as Hindi)
   *   4. everyone else
   * Inside a group: most watched first (live) or soonest first (upcoming).
   * `tag` keeps only lives with that topic chip.
   */
  async list(f: { status: "live" | "upcoming"; tag?: string | null; customerId?: string | null; lang?: string | null }): Promise<LiveCard[]> {
    const { LiveSessionModel, AstroFollowModel } = await M();
    const tag = f.tag && (LIVE_TAGS as readonly string[]).includes(f.tag) ? f.tag : null;
    const base = f.status === "live"
      ? { status: "live" }
      : { status: "scheduled", scheduledAt: { $gte: new Date(Date.now() - 3600_000).toISOString() } };
    const rows = await LiveSessionModel.find({ ...base, ...(tag ? { tags: tag } : {}) }).sort(f.status === "live" ? { startedAt: -1 } : { scheduledAt: 1 }).limit(80).lean<Doc[]>();
    const lives = rows.map(out).filter(Boolean) as LiveSession[];
    const fresh: LiveSession[] = [];
    for (const s of lives) { const x = await sweepOne(s); if (x.status === (f.status === "live" ? "live" : "scheduled")) fresh.push(x); }
    const followed = new Set<string>();
    if (f.customerId && fresh.length) {
      const rowsF = await AstroFollowModel.find({ customerId: f.customerId, astrologerId: { $in: fresh.map((x) => x.astrologerId) } }).select("astrologerId").lean<Doc[]>();
      for (const r of rowsF) followed.add(r.astrologerId as string);
    }
    const lang = f.lang ? langKey(f.lang) : null;
    const whyOf = (s: LiveSession): LiveCard["why"] =>
      s.featured ? "featured" : followed.has(s.astrologerId) ? "following" : lang && s.languages.some((l) => langKey(l) === lang) ? "language" : null;
    const rank: Record<string, number> = { featured: 0, following: 1, language: 2 };
    const featAt = new Map(fresh.map((s) => [s.id, s.featuredAt ?? ""]));
    const cards = await Promise.all(fresh.map((s) => card(s, whyOf(s))));
    return cards.sort((a, b) => {
      const g = (rank[a.why ?? ""] ?? 3) - (rank[b.why ?? ""] ?? 3);
      if (g) return g;
      if (a.why === "featured") return String(featAt.get(b.id)).localeCompare(String(featAt.get(a.id)));
      return f.status === "live"
        ? b.viewers - a.viewers || b.likes - a.likes
        : String(a.scheduledAt).localeCompare(String(b.scheduledAt));
    }).slice(0, 50);
  },

  /**
   * Long-poll: answers at once when the live changed (version ≠ v) or has new
   * events after `after`, else waits up to `waitMs`. Keeps the caller's
   * presence fresh (viewer count / astrologer heartbeat) and runs the sweep.
   */
  async events(who: LiveWho, id: string, after: number, v: number, waitMs: number): Promise<Result<{ live: LiveView; events: LiveEvent[]; me: LiveMe | null; queue: LiveQueueItem[] | null; gifts: LiveGift[]; config: LiveConfig | null }>> {
    let s = await get(id);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    const role = roleOf(s, who);
    const { LiveEventModel, LiveQueueModel } = await M();
    const until = Date.now() + Math.min(Math.max(waitMs, 0), 20_000);
    for (;;) {
      s = await sweepOne(s!);
      if (role === "astrologer") s = await beat(s);
      if (role === "customer" && who.customerId) await touchViewer(s, who.customerId).catch(() => undefined);
      const changed = s.version !== v || s.seq > after;
      if (changed || Date.now() >= until || s.status === "ended" || s.status === "cancelled") {
        s = (await get(id)) ?? s;
        let docs: Doc[] = [];
        if (s.seq > after) {
          docs = after <= 0
            ? (await LiveEventModel.find({ liveId: id }).sort({ seq: -1 }).limit(60).lean<Doc[]>()).reverse()
            : await LiveEventModel.find({ liveId: id, seq: { $gt: after } }).sort({ seq: 1 }).limit(150).lean<Doc[]>();
        }
        const hidden = new Set(s.hiddenSeqs);
        // Filtered (shadow) comments: only their sender sees them, so they do not know and do not retry.
        const events = docs
          .filter((d) => !hidden.has(d.seq as number) && (!d.shadow || (who.customerId && d.customerId === who.customerId && role === "customer")))
          .map((d) => evOut(d, who.customerId));
        // Clients need the newest seq even when the newest events are hidden.
        const queue = role === "astrologer"
          ? (await LiveQueueModel.find({ liveId: id, status: { $in: ["waiting", "answering"] } }).sort(QUEUE_SORT).limit(100).lean<Doc[]>()).map(qOut)
          : null;
        return ok({ live: await view(s, role), events, me: role === "customer" && who.customerId ? await meOf(s, who.customerId) : null, queue, gifts: role === "customer" ? await giftsList() : [], config: role === "astrologer" ? null : await liveConfig() });
      }
      await new Promise((r) => setTimeout(r, 1000));
      s = (await get(id)) ?? s;
    }
  },

  /* ---------- customer ---------- */

  async comment(who: LiveWho, id: string, text: string, clientId: string): Promise<Result<{ event: LiveEvent }>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    const role = roleOf(s, who);
    if (role === "guest") return fail(AppErrors.unauthorized("Please sign in to comment"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 300);
    if (!clean) return fail(AppErrors.validation("Type a comment"));
    const st = await astroSettingsService.get();
    const m = st.maskContactInfo ? maskContacts(clean) : { text: clean, masked: false };
    if (role === "astrologer") {
      const r = await addEvent(id, { kind: "comment", by: "astrologer", name: s.astrologer.name, text: m.text, clientId }, { inc: { commentCount: 1 } });
      return r ? ok({ event: evOut(r.event) }) : fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    }
    const cid = who.customerId!;
    const { LiveViewerModel, LiveEventModel } = await M();
    // A retry of a comment that already went through answers the same (even if muted since).
    const dup = await LiveEventModel.findOne({ liveId: id, clientId }).lean<Doc>();
    if (dup) return ok({ event: evOut(dup, cid) });
    if (s.commentsOff) return fail(AppErrors.validation("Comments are turned off for now.", { reason: "COMMENTS_OFF" }));
    if (s.muted.includes(cid)) return fail(AppErrors.forbidden("You cannot comment on this live.", { reason: "MUTED" }));
    if (await isBlocked(s.astrologerId, cid)) return fail(AppErrors.forbidden(`You cannot comment on ${s.astrologer.name}'s lives.`, { reason: "BLOCKED" }));
    const f = filterText(clean, st.live.blockedWords);
    if (f.action === "reject") return fail(AppErrors.validation(f.reason ?? "Write a comment", { reason: "EMPTY" }));
    await touchViewer(s, cid);
    const v = await LiveViewerModel.findOne({ liveId: id, customerId: cid }).select("recent").lean<Doc>();
    if (isRepeat(f.text, (v?.recent as { t: string; at: string }[]) ?? [])) {
      return fail(AppErrors.validation("You just sent this. Write something new.", { reason: "DUPLICATE" }));
    }
    // Slow mode: claim the comment slot atomically on the viewer row.
    const at = nowIso();
    const gate = s.slowSec > 0 ? new Date(Date.now() - s.slowSec * 1000).toISOString() : at;
    const claimed = await LiveViewerModel.updateOne(
      { liveId: id, customerId: cid, $or: [{ lastCommentAt: null }, { lastCommentAt: { $lte: gate } }] },
      { $set: { lastCommentAt: at, lastSeen: at }, $push: { recent: { $each: [{ t: norm(f.text), at }], $slice: -5 } } },
    );
    if (claimed.matchedCount === 0) return fail(AppErrors.rateLimited(`Slow mode is on. You can comment every ${s.slowSec} seconds.`, { reason: "SLOW" }));
    const name = await customerName(cid);
    const shown = st.maskContactInfo ? maskContacts(f.text).text : f.text;
    // Abuse: posted as a shadow comment (only the sender sees it) and counted as a strike.
    const shadow = f.action === "hide";
    const r = await addEvent(id, { kind: "comment", by: "customer", name, text: shown, customerId: cid, clientId, shadow }, shadow ? {} : { inc: { commentCount: 1 } });
    if (!r) return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    if (shadow) {
      const row = await LiveViewerModel.findOneAndUpdate({ liveId: id, customerId: cid }, { $inc: { strikes: 1 } }, { new: true }).select("strikes").lean<Doc>();
      const limit = st.live.autoMuteStrikes;
      if (limit > 0 && ((row?.strikes as number) ?? 0) >= limit) await muteViewer(s, cid, "System");
    }
    return ok({ event: evOut(r.event, cid) });
  },

  /** Hearts. Counted in batches (the app sends a count every few seconds). */
  async like(who: LiveWho, id: string, count: number): Promise<Result<{ likes: number }>> {
    const s = await get(id);
    if (!s || s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    if (!who.customerId) return fail(AppErrors.unauthorized("Please sign in"));
    const n = Math.max(1, Math.min(30, Math.floor(count)));
    const { LiveViewerModel, LiveSessionModel } = await M();
    // Cap per viewer so one phone cannot inflate the count forever.
    const r = await LiveViewerModel.updateOne({ liveId: id, customerId: who.customerId, likes: { $lt: 3000 } }, { $inc: { likes: n } });
    if (r.matchedCount === 0) return ok({ likes: s.likes });
    const d = await LiveSessionModel.findOneAndUpdate({ _id: id }, { $inc: { likes: n } }, { new: true }).select("likes").lean<Doc>();
    return ok({ likes: (d?.likes as number) ?? s.likes + n });
  },

  /** Gift (or a combo of the same gift, ×5 / ×10) as one charge and one event. */
  async gift(customerId: string, id: string, giftId: string, clientId: string, count = 1): Promise<Result<{ event: LiveEvent; balancePaise: number }>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    const base = (await giftsList()).find((x) => x.id === giftId);
    if (!base) return fail(AppErrors.validation("This gift is not available"));
    if (await isBlocked(s.astrologerId, customerId)) return fail(AppErrors.forbidden(`You cannot send gifts on ${s.astrologer.name}'s lives.`, { reason: "BLOCKED" }));
    const cfg = await liveConfig();
    if (!cfg.giftCombos.includes(count)) return fail(AppErrors.validation("This combo is not available"));
    // One charge for the whole combo; the event carries the count.
    const g = { ...base, price: base.price * count };
    const { LiveEventModel } = await M();
    const { walletService } = await import("@/modules/wallets");
    const balance = async () => { const b = await walletService.balance(customerId); return b.cashPaise + b.promoPaise; };
    const dup = await LiveEventModel.findOne({ liveId: id, clientId }).lean<Doc>();
    if (dup) return ok({ event: evOut(dup, customerId), balancePaise: await balance() });
    const pricePaise = g.price * 100;
    const key = `live:${id}:gift:${clientId}`;
    const label = count > 1 ? `${g.name} ×${count}` : g.name;
    const charge = await walletService.charge(customerId, key, pricePaise, id, `Gift ${g.emoji} ${label} to ${s.astrologer.name} (live)`);
    if (charge.status === "insufficient") {
      return fail(AppErrors.validation(`Not enough wallet balance for ${label} (₹${g.price}).`, { reason: "LOW_BALANCE", needPaise: pricePaise, balancePaise: charge.balance.cashPaise + charge.balance.promoPaise }));
    }
    await touchViewer(s, customerId).catch(() => undefined);
    const name = await customerName(customerId);
    const earning = Math.floor((pricePaise * (100 - s.commissionPct)) / 100);
    const r = await addEvent(id, { kind: "gift", by: "customer", name, text: `sent ${label} ${g.emoji}`, customerId, clientId, gift: { id: g.id, name: g.name, emoji: g.emoji, price: base.price, count } }, { inc: { giftCount: count, giftsPaise: pricePaise, earningPaise: earning } });
    if (!r) {
      // The live ended between the charge and the gift: give the money back.
      const txn = charge.txn;
      if (txn) await walletService.refund(customerId, `${key}:refund`, { cashPaise: Math.abs(txn.cashPaise), promoPaise: Math.abs(txn.promoPaise) }, id, `Gift refunded: the live had ended`, "System").catch(() => undefined);
      return fail(AppErrors.validation("This live has ended. Your money was returned to the wallet.", { reason: "NOT_LIVE" }));
    }
    try {
      const { earningsLedger } = await import("@/modules/earnings");
      await earningsLedger.gift({ liveId: id, liveNumber: s.liveNumber, clientId, astrologerId: s.astrologerId, pricePaise, earningPaise: earning, giftName: `${g.emoji} ${label}`, from: name });
    } catch { /* reconciled later */ }
    return ok({ event: evOut(r.event, customerId), balancePaise: await balance() });
  },

  /**
   * Ask on live. Free, or a Super Chat (`paid.pricePaise` = one of the tiers):
   * charged from the wallet now (idempotent on `paid.clientId`), the question
   * moves up the line (higher amount first) and is highlighted for everyone.
   * Kept only when answered; skipped / muted / left / live ended = refunded.
   * A free question already in the line can be upgraded to a Super Chat.
   */
  async joinQueue(customerId: string, id: string, question: string, paid?: { pricePaise: number; clientId: string }): Promise<Result<LiveMe>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    if (!s.queueOpen) return fail(AppErrors.validation("Questions are closed for now.", { reason: "QUEUE_CLOSED" }));
    if (s.muted.includes(customerId)) return fail(AppErrors.forbidden("You cannot ask on this live.", { reason: "MUTED" }));
    if (await isBlocked(s.astrologerId, customerId)) return fail(AppErrors.forbidden(`You cannot ask on ${s.astrologer.name}'s lives.`, { reason: "BLOCKED" }));
    const st = await astroSettingsService.get();
    const { LiveQueueModel } = await M();
    const openKey = `${id}:${customerId}`;
    let tier: { price: number; pinSec: number } | undefined;
    if (paid) {
      if (!st.live.superChat.enabled) return fail(AppErrors.validation("Super Chat is not available right now.", { reason: "SUPERCHAT_OFF" }));
      tier = st.live.superChat.tiers.find((t) => t.price * 100 === paid.pricePaise);
      if (!tier) return fail(AppErrors.validation("Pick one of the Super Chat amounts."));
      // Same tap again (retry): nothing new.
      const again = await LiveQueueModel.findOne({ liveId: id, customerId, paidKey: `live:${id}:sc:${paid.clientId}` }).lean<Doc>();
      if (again) return ok(await meOf(s, customerId));
    }
    const existing = await LiveQueueModel.findOne({ openKey }).lean<Doc>();
    const q = (question.replace(/\s+/g, " ").trim().slice(0, 200)) || (existing?.question as string | undefined) || "";
    if (q.length < 3) return fail(AppErrors.validation("Write your question (at least 3 characters)"));
    // Checked before any charge: an abusive question is refused, never paid for.
    const fq = filterText(q, st.live.blockedWords);
    if (fq.action === "reject") return fail(AppErrors.validation("Write your question (at least 3 characters)"));
    if (fq.action === "hide") return fail(AppErrors.validation("Please write your question without bad words.", { reason: "ABUSIVE" }));
    const clean = st.maskContactInfo ? maskContacts(fq.text).text : fq.text;

    if (existing) {
      if (!paid) return ok(await meOf(s, customerId)); // already in line
      if (existing.status !== "waiting") return fail(AppErrors.validation("Your question is being answered now."));
      if (((existing.paidPaise as number) ?? 0) > 0) return fail(AppErrors.validation("Your question is already a Super Chat.", { reason: "ALREADY_PAID" }));
    } else if (!paid && (await queueCount(id)) >= st.live.maxQueue) {
      // Paid questions are always accepted; free ones respect the limit.
      return fail(AppErrors.validation("The question list is full. Try a Super Chat to jump the line, or try a little later.", { reason: "QUEUE_FULL" }));
    }

    let split: { cashPaise: number; promoPaise: number } | null = null;
    const paidKey = paid ? `live:${id}:sc:${paid.clientId}` : null;
    if (paid && paidKey) {
      const { walletService } = await import("@/modules/wallets");
      const charge = await walletService.charge(customerId, paidKey, paid.pricePaise, id, `Super Chat ₹${paid.pricePaise / 100} on ${s.astrologer.name}'s live`);
      if (charge.status === "insufficient") return fail(AppErrors.validation(`Not enough wallet balance for a ₹${paid.pricePaise / 100} Super Chat.`, { reason: "LOW_BALANCE", needPaise: paid.pricePaise, balancePaise: charge.balance.cashPaise + charge.balance.promoPaise }));
      const t = charge.txn;
      split = t ? { cashPaise: Math.abs(t.cashPaise), promoPaise: Math.abs(t.promoPaise) } : { cashPaise: paid.pricePaise, promoPaise: 0 };
    }
    const at = nowIso();
    const name = await customerName(customerId);
    let entry: Doc | null = null;
    try {
      if (existing && paid) {
        entry = await LiveQueueModel.findOneAndUpdate(
          { _id: existing._id, status: "waiting", $or: [{ paidPaise: 0 }, { paidPaise: null }] },
          { $set: { paidPaise: paid.pricePaise, paidSplit: split, paidKey, paidState: "held", question: clean, updatedAt: at, rankAt: at } },
          { new: true },
        ).lean<Doc>();
      } else {
        const d = await LiveQueueModel.create({
          liveId: id, customerId, name, question: clean, status: "waiting", openKey, createdAt: at, updatedAt: at, rankAt: at,
          paidPaise: paid?.pricePaise ?? 0, paidSplit: split, paidKey, paidState: paid ? "held" : "none",
        });
        entry = d.toObject() as Doc;
      }
    } catch (e) {
      if (!isDup(e, "openKey")) throw e;
    }
    // Charged but could not attach (raced with the line changing): give it back.
    if (paid && paidKey && !entry) {
      const { walletService } = await import("@/modules/wallets");
      await walletService.refund(customerId, `${paidKey}:refund`, split ?? { cashPaise: paid.pricePaise, promoPaise: 0 }, id, "Super Chat refunded: your question changed at the same time", "System").catch(() => undefined);
      return fail(AppErrors.conflict("Your question was just updated. Your money is back in the wallet. Please try again."));
    }
    if (paid && entry && tier) {
      // Highlight for everyone + a line in the chat.
      const r = await addEvent(id, { kind: "superchat", by: "customer", name, text: clean, customerId, clientId: `sc-${paid.clientId}` }, { inc: { superChatCount: 1 } });
      if (r) await bump(id, { $set: { superPin: { seq: r.event.seq as number, name, text: clean, amount: paid.pricePaise / 100, until: new Date(Date.now() + tier.pinSec * 1000).toISOString() } } });
      else {
        // The live ended between the charge and the highlight.
        await settleSuper({ ...entry, paidState: "held" }, "refunded", s, "System");
        return fail(AppErrors.validation("This live has ended. Your money was returned to the wallet.", { reason: "NOT_LIVE" }));
      }
    }
    const after = (await bump(id, {})) ?? s;
    return ok(await meOf(after, customerId));
  },

  /**
   * "1-to-1 chat" from the live screen: a place in the astrologer's chat line
   * (waitlist). While they are live nobody is offered a turn; when the live
   * ends the first in line gets it. Already in this line = same entry back.
   */
  async privateChat(customerId: string, id: string, question: string): Promise<Result<import("@/modules/consultations").WaitEntryView>> {
    const s = await get(id);
    if (!s || s.status === "cancelled") return fail(AppErrors.notFound("This live is not available"));
    if (await isBlocked(s.astrologerId, customerId)) return fail(AppErrors.forbidden(`${s.astrologer.name} is not taking chats right now.`, { reason: "BLOCKED" }));
    const { waitlistService } = await import("@/modules/consultations/consult.waitlist");
    const r = await waitlistService.join(customerId, s.astrologerId, question, { fromLiveId: id });
    cache.del(`live:pc:${s.astrologerId}`);
    return r;
  },

  async leaveQueue(customerId: string, id: string): Promise<Result<LiveMe>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("This live is not available"));
    const { LiveQueueModel } = await M();
    const q = await LiveQueueModel.findOneAndUpdate({ openKey: `${id}:${customerId}`, status: "waiting" }, { $set: { status: "left", openKey: null, updatedAt: nowIso() } }, { new: true }).lean<Doc>();
    if (q) await settleSuper(q, "refunded", s, "Customer");
    const after = q ? ((await bump(id, {})) ?? s) : s;
    return ok(await meOf(after, customerId));
  },

  /* ---------- astrologer ---------- */

  /** Go live now, or schedule for later. */
  async create(astrologerId: string, input: { title: string; topic?: string; scheduledAt?: string | null; tags?: string[] }): Promise<Result<LiveView>> {
    const st = await astroSettingsService.get();
    if (!st.live.enabled) return fail(AppErrors.forbidden("Live sessions are turned off right now."));
    const a = await astrologerService.getInternal(astrologerId);
    if (!a || a.status !== "approved" || a.hidden) return fail(AppErrors.forbidden("Your profile must be approved and visible to go live."));
    const title = input.title.replace(/\s+/g, " ").trim().slice(0, 80);
    if (title.length < 3) return fail(AppErrors.validation("Add a title (at least 3 characters)"));
    const topic = (input.topic ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const { LiveSessionModel } = await M();
    const base = {
      liveNumber: `LV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      astrologerId, astrologer: { name: a.displayName, photo: a.photo ?? null, slug: a.slug },
      title: maskContacts(title).text, topic: maskContacts(topic).text, commissionPct: a.commissionPct ?? st.commissionPct, slowSec: st.live.slowSec,
      tags: [...new Set((input.tags ?? []).filter((t) => (LIVE_TAGS as readonly string[]).includes(t)))].slice(0, 3),
      languages: (a.languages ?? []).slice(0, 10),
    };
    if (filterText(title, st.live.blockedWords).action === "hide" || filterText(topic || "ok", st.live.blockedWords).action === "hide") {
      return fail(AppErrors.validation("Please change the title or topic: it has words that are not allowed."));
    }
    if (input.scheduledAt) {
      const t = Date.parse(input.scheduledAt);
      if (!Number.isFinite(t) || t < Date.now() + 5 * 60_000 || t > Date.now() + 30 * 86_400_000) return fail(AppErrors.validation("Pick a time between 5 minutes and 30 days from now."));
      if ((await LiveSessionModel.countDocuments({ astrologerId, status: "scheduled" })) >= 5) return fail(AppErrors.validation("You can schedule up to 5 lives at a time."));
      const d = await LiveSessionModel.create({ ...base, status: "scheduled", scheduledAt: new Date(t).toISOString() });
      return ok(await view(out(d.toObject() as Doc)!, "astrologer"));
    }
    return this.goLive(astrologerId, null, base);
  },

  /** Start a scheduled live (or a new one when `liveId` is null). */
  async goLive(astrologerId: string, liveId: string | null, base?: Record<string, unknown>): Promise<Result<LiveView>> {
    const st = await astroSettingsService.get();
    if (!st.live.enabled) return fail(AppErrors.forbidden("Live sessions are turned off right now."));
    const { LiveSessionModel } = await M();
    const already = await LiveSessionModel.findOne({ openAstro: astrologerId }).lean<Doc>();
    if (already) return ok(await view(out(already)!, "astrologer"));
    // Never while in a chat.
    const { ConsultSessionModel } = await import("@/modules/consultations/consult.model");
    if (await ConsultSessionModel.exists({ openAstro: astrologerId })) return fail(AppErrors.validation("Finish your current chat before going live.", { reason: "IN_CHAT" }));
    // Same gates as going online (approval, KYC, partner agreement).
    const p = await astrologerService.presence(astrologerId, { action: "online" });
    if (!p.ok) return fail(p.error);
    const at = nowIso();
    let s: LiveSession | null;
    try {
      if (liveId) {
        const cur = await get(liveId);
        if (!cur || cur.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
        if (cur.status !== "scheduled") return fail(AppErrors.validation("This live cannot be started."));
        s = await cas(liveId, ["scheduled"], { status: "live", startedAt: at, lastBeatAt: at, openAstro: astrologerId });
        if (!s) return fail(AppErrors.validation("This live cannot be started."));
      } else {
        const d = await LiveSessionModel.create({ ...(base ?? {}), status: "live", startedAt: at, lastBeatAt: at, openAstro: astrologerId });
        s = out(d.toObject() as Doc);
      }
    } catch (e) {
      if (isDup(e, "openAstro")) {
        const cur = await LiveSessionModel.findOne({ openAstro: astrologerId }).lean<Doc>();
        if (cur) return ok(await view(out(cur)!, "astrologer"));
      }
      throw e;
    }
    await addEvent(s!.id, { kind: "system", by: "system", name: "", text: `${s!.astrologer.name} is live. Ask your questions in the comments.` });
    await auditService.record({ action: "status", entity: "live", entityId: s!.id, entityLabel: s!.liveNumber, summary: `${s!.astrologer.name} went live: ${s!.title}`, actor: "Astrologer" }).catch(() => undefined);
    return ok(await view((await get(s!.id)) ?? s!, "astrologer"));
  },

  async cancelScheduled(astrologerId: string, id: string): Promise<Result<LiveView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    if (s.status !== "scheduled") return ok(await view(s, "astrologer"));
    const done = await cas(id, ["scheduled"], { status: "cancelled", endedAt: nowIso() });
    return ok(await view(done ?? s, "astrologer"));
  },

  async end(astrologerId: string, id: string): Promise<Result<LiveView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    const done = await endLive(s, "astrologer", "Astrologer");
    return ok(await view(done ?? s, "astrologer"));
  },

  /* ---------- video (camera) ---------- */

  /** LiveKit token so the panel can publish the camera into this live's room. */
  async videoToken(astrologerId: string, id: string): Promise<Result<{ url: string; token: string }>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    if (!liveVideoConfigured()) return fail(AppErrors.validation("Live video is not set up on the server yet.", { reason: "VIDEO_NOT_SET_UP" }));
    return ok(await publisherToken(id, astrologerId, s.astrologer.name));
  },

  /** The camera is publishing: start the HLS recorder and tell viewers. Idempotent. */
  async videoOn(astrologerId: string, id: string): Promise<Result<LiveView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    if (!liveVideoConfigured()) return fail(AppErrors.validation("Live video is not set up on the server yet.", { reason: "VIDEO_NOT_SET_UP" }));
    if (s.stream?.egressId) return ok(await view(s, "astrologer"));
    let egressId: string;
    try {
      egressId = await startHlsEgress(id);
    } catch (e) {
      const { logger } = await import("@/core/logger");
      logger.error("live video egress failed", { liveId: id, error: e instanceof Error ? e.message : String(e) });
      return fail(AppErrors.validation("Could not start the video for viewers. Check your camera is on and try again.", { reason: "VIDEO_FAILED" }));
    }
    // Only one recorder per live: if another tab won the race, stop ours.
    const done = await bump(id, { $set: { stream: { provider: "livekit-hls", playbackUrl: liveHlsUrl(id), startedAt: nowIso(), egressId } } }, { status: "live", stream: null });
    if (!done) { await stopEgress(egressId).catch(() => undefined); return ok(await view((await get(id)) ?? s, "astrologer")); }
    await addEvent(id, { kind: "system", by: "system", name: "", text: "Video is on. It may take a few seconds to appear." });
    return ok(await view(done, "astrologer"));
  },

  /** Camera off: stop the recorder; viewers see the photo again. */
  async videoOff(astrologerId: string, id: string): Promise<Result<LiveView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    if (s.stream?.egressId && liveVideoConfigured()) await stopEgress(s.stream.egressId).catch(() => undefined);
    const done = s.stream ? await bump(id, { $set: { stream: null } }) : s;
    return ok(await view(done ?? s, "astrologer"));
  },

  /** pin / hide / mute (by event seq), settings, and the question queue. */
  async moderate(astrologerId: string, id: string, action: string, body: Record<string, unknown>): Promise<Result<LiveView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Live not found"));
    if (s.status !== "live") return fail(AppErrors.validation("This live has ended.", { reason: "NOT_LIVE" }));
    const { LiveEventModel, LiveQueueModel } = await M();
    const seq = Number(body.seq);
    const evAt = async () => (Number.isInteger(seq) && seq > 0 ? LiveEventModel.findOne({ liveId: id, seq }).lean<Doc>() : null);
    let next: LiveSession | null = s;
    switch (action) {
      case "pin": {
        if (body.seq === null) { next = await bump(id, { $set: { pinned: null } }); break; }
        const e = await evAt();
        if (!e || e.kind !== "comment") return fail(AppErrors.validation("Only comments can be pinned"));
        next = await bump(id, { $set: { pinned: { seq, name: e.name, text: e.text } } });
        break;
      }
      case "hide": {
        if (!(await evAt())) return fail(AppErrors.notFound("Comment not found"));
        next = await bump(id, { $push: { hiddenSeqs: { $each: [seq], $slice: -300 } }, $set: { ...(s.pinned?.seq === seq ? { pinned: null } : {}), ...(s.superPin?.seq === seq ? { superPin: null } : {}) } });
        break;
      }
      case "mute": {
        const e = await evAt();
        const cid = e?.customerId as string | undefined;
        if (!cid) return fail(AppErrors.validation("This comment cannot be muted"));
        next = await bump(id, { $addToSet: { muted: cid }, $push: { hiddenSeqs: { $each: [seq], $slice: -300 } }, ...(s.superPin?.seq === seq ? { $set: { superPin: null } } : {}) });
        const theirs = await LiveQueueModel.findOneAndUpdate({ openKey: `${id}:${cid}`, status: "waiting" }, { $set: { status: "skipped", openKey: null, updatedAt: nowIso() } }, { new: true }).lean<Doc>();
        if (theirs) await settleSuper(theirs, "refunded", s, "Astrologer");
        break;
      }
      case "block": {
        // For good: this live (muted, comment hidden, question out with refund) and every future live, chat and waitlist.
        const e = await evAt();
        const cid = e?.customerId as string | undefined;
        if (!cid) return fail(AppErrors.validation("This comment cannot be blocked"));
        const { ConsultBlockModel } = await import("@/modules/consultations/consult.model");
        await ConsultBlockModel.updateOne(
          { astrologerId, customerId: cid },
          { $set: { name: (e!.name as string) || "Customer", via: "live", reason: String(body.reason ?? "Blocked on live").slice(0, 300), at: nowIso() } },
          { upsert: true },
        );
        await muteViewer(s, cid, "Astrologer", { $push: { hiddenSeqs: { $each: [seq], $slice: -300 } }, ...(s.superPin?.seq === seq || s.pinned?.seq === seq ? { $set: { ...(s.superPin?.seq === seq ? { superPin: null } : {}), ...(s.pinned?.seq === seq ? { pinned: null } : {}) } } : {}) });
        try {
          const { waitlistService } = await import("@/modules/consultations/consult.waitlist");
          await waitlistService.removeCustomer(astrologerId, cid, "Blocked by the astrologer");
        } catch { /* nothing to remove */ }
        cache.del(`live:pc:${astrologerId}`);
        await auditService.record({ action: "update", entity: "live", entityId: id, entityLabel: s.liveNumber, summary: `${s.astrologer.name} blocked ${(e!.name as string) || "a customer"} on live ${s.liveNumber}`, actor: "Astrologer" }).catch(() => undefined);
        next = await get(id);
        break;
      }
      case "settings": {
        const set: Record<string, unknown> = {};
        if (typeof body.commentsOff === "boolean") set.commentsOff = body.commentsOff;
        if (typeof body.queueOpen === "boolean") set.queueOpen = body.queueOpen;
        if (typeof body.slowSec === "number" && Number.isInteger(body.slowSec) && body.slowSec >= 0 && body.slowSec <= 120) set.slowSec = body.slowSec;
        if (!Object.keys(set).length) return fail(AppErrors.validation("Nothing to change"));
        next = await bump(id, { $set: set });
        if (typeof set.commentsOff === "boolean" && set.commentsOff !== s.commentsOff) await addEvent(id, { kind: "system", by: "system", name: "", text: set.commentsOff ? "Comments are turned off for now." : "Comments are on again." });
        break;
      }
      case "answer": case "done": case "skip": {
        const qid = String(body.queueId ?? "");
        if (!isId(qid)) return fail(AppErrors.validation("Pick a question"));
        const q = await LiveQueueModel.findOne({ _id: qid, liveId: id }).lean<Doc>();
        if (!q) return fail(AppErrors.notFound("Question not found"));
        const at = nowIso();
        if (action === "answer") {
          if (q.status !== "waiting" && q.status !== "answering") return fail(AppErrors.validation("This question is no longer waiting"));
          // One at a time: the previous one counts as answered (its Super Chat is kept).
          const prev = await LiveQueueModel.find({ liveId: id, status: "answering", _id: { $ne: qid } }).lean<Doc[]>();
          await LiveQueueModel.updateMany({ liveId: id, status: "answering", _id: { $ne: qid } }, { $set: { status: "answered", openKey: null, updatedAt: at } });
          for (const p of prev) await settleSuper(p, "earned", s, "Astrologer");
          await LiveQueueModel.updateOne({ _id: qid }, { $set: { status: "answering", updatedAt: at } });
          next = await bump(id, { $set: { answering: { queueId: qid, name: q.name, question: q.question, paidPaise: (q.paidPaise as number) ?? 0 } } });
          await addEvent(id, { kind: "system", by: "system", name: "", text: `Now answering ${q.name}: "${String(q.question).slice(0, 120)}"` });
        } else {
          const closed = await LiveQueueModel.findOneAndUpdate({ _id: qid, status: { $in: ["waiting", "answering"] } }, { $set: { status: action === "done" ? "answered" : "skipped", openKey: null, updatedAt: at } }, { new: true }).lean<Doc>();
          // Answered = the astrologer keeps the Super Chat; skipped = the customer gets it back.
          if (closed) await settleSuper(closed, action === "done" ? "earned" : "refunded", s, "Astrologer");
          next = await bump(id, s.answering?.queueId === qid ? { $set: { answering: null } } : {});
        }
        break;
      }
      default:
        return fail(AppErrors.notFound("Unknown action"));
    }
    return ok(await view((await get(id)) ?? next ?? s, "astrologer"));
  },

  /** The partner panel: current live, scheduled and recent ones. */
  async mine(astrologerId: string): Promise<{ current: LiveView | null; scheduled: LiveView[]; past: LiveView[] }> {
    const { LiveSessionModel } = await M();
    const rows = (await LiveSessionModel.find({ astrologerId }).sort({ createdAt: -1 }).limit(60).lean<Doc[]>()).map(out).filter(Boolean) as LiveSession[];
    const fresh: LiveSession[] = [];
    for (const r of rows) fresh.push(await sweepOne(r));
    const cur = fresh.find((x) => x.status === "live") ?? null;
    return {
      current: cur ? await view(cur, "astrologer") : null,
      scheduled: await Promise.all(fresh.filter((x) => x.status === "scheduled").sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))).map((x) => view(x, "astrologer"))),
      past: await Promise.all(fresh.filter((x) => x.status === "ended").slice(0, 20).map((x) => view(x, "astrologer"))),
    };
  },

  /* ---------- admin ---------- */

  async adminList(f: { status?: string }): Promise<LiveSession[]> {
    const { LiveSessionModel } = await M();
    const q = f.status === "live" ? { status: "live" } : f.status === "scheduled" ? { status: "scheduled" } : {};
    const rows = (await LiveSessionModel.find(q).sort({ createdAt: -1 }).limit(150).lean<Doc[]>()).map(out).filter(Boolean) as LiveSession[];
    const res: LiveSession[] = [];
    for (const r of rows) res.push(await sweepOne(r));
    return res;
  },

  async adminGet(id: string): Promise<Result<{ live: LiveSession; viewers: number; events: (LiveEvent & { hidden: boolean; filtered: boolean })[]; queue: LiveQueueItem[] }>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Live not found"));
    const { LiveEventModel, LiveQueueModel } = await M();
    const hidden = new Set(s.hiddenSeqs);
    const events = (await LiveEventModel.find({ liveId: id, kind: { $ne: "join" } }).sort({ seq: -1 }).limit(500).lean<Doc[]>()).reverse().map((d) => ({ ...evOut(d), hidden: hidden.has(d.seq as number), filtered: d.shadow === true }));
    const queue = (await LiveQueueModel.find({ liveId: id }).sort(QUEUE_SORT).limit(200).lean<Doc[]>()).map(qOut);
    return ok({ live: s, viewers: await viewersOf(s), events, queue });
  },

  async adminEnd(id: string, adminName: string): Promise<Result<LiveSession>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Live not found"));
    if (s.status === "scheduled") return ok((await cas(id, ["scheduled"], { status: "cancelled", endedAt: nowIso() })) ?? s);
    return ok((await endLive(s, "admin", adminName)) ?? s);
  },

  /** Pin a live (on now or scheduled) to the top of everyone's feed, or unpin it. */
  async adminFeature(id: string, on: boolean, adminName: string): Promise<Result<LiveSession>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Live not found"));
    if (on && s.status !== "live" && s.status !== "scheduled") return fail(AppErrors.validation("Only a live that is on or coming up can be featured."));
    if (s.featured === on) return ok(s);
    const done = await bump(id, { $set: { featured: on, featuredAt: on ? nowIso() : null } });
    await auditService.record({ action: "update", entity: "live", entityId: id, entityLabel: s.liveNumber, summary: `${on ? "Featured" : "Removed from featured"}: live ${s.liveNumber} by ${s.astrologer.name}`, actor: adminName }).catch(() => undefined);
    return ok(done ?? s);
  },

  async adminHide(id: string, seq: number, adminName: string): Promise<Result<LiveSession>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Live not found"));
    const done = await bump(id, { $push: { hiddenSeqs: { $each: [seq], $slice: -300 } }, ...(s.pinned?.seq === seq ? { $set: { pinned: null } } : {}) });
    await auditService.record({ action: "update", entity: "live", entityId: id, entityLabel: s.liveNumber, summary: `Hid comment #${seq} on live ${s.liveNumber}`, actor: adminName }).catch(() => undefined);
    return ok(done ?? s);
  },
};
