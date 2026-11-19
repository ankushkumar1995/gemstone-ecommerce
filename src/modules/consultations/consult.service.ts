import "server-only";

/**
 * Consultation engine (chat). See consult.types.ts for the lifecycle and the
 * billing rules. Every state change is a compare-and-set on `status` (and
 * `minutesCharged` for billing), so two devices, two servers, the sweep and a
 * retry can race without double-charging, double-ending or a lost update.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import { astrologerService, isOnline } from "@/modules/astrologers";
import { maskContacts } from "./consult.mask";
import type { ConsultCard, ConsultMessage, ConsultRole, ConsultSession, EndReason } from "./consult.types";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./consult.model");
}
async function wallet() {
  const { walletService } = await import("@/modules/wallets");
  return walletService;
}

const OPEN: ConsultSession["status"][] = ["requested", "active"];
/** A customer counts as "connected" this long after their last poll. */
const PRESENT_MS = 30_000;
const TYPING_MS = 6_000;
const nowIso = () => new Date().toISOString();

function out(d: Doc | null): ConsultSession | null {
  if (!d) return null;
  const { _id, ...rest } = d;
  return { ...(rest as unknown as Omit<ConsultSession, "id">), id: String(_id), lastSeen: (d.lastSeen as ConsultSession["lastSeen"]) ?? {}, typing: (d.typing as ConsultSession["typing"]) ?? {}, read: (d.read as ConsultSession["read"]) ?? {}, reports: (d.reports as ConsultSession["reports"]) ?? [] };
}
const msgOut = (d: Doc): ConsultMessage => ({ id: String(d._id), seq: d.seq as number, from: d.from as ConsultMessage["from"], text: d.text as string, masked: Boolean(d.masked), at: d.at as string, ...(d.clientId ? { clientId: d.clientId as string } : {}), ...(d.card ? { card: d.card as ConsultCard } : {}) });

async function get(id: string): Promise<ConsultSession | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const { ConsultSessionModel } = await M();
  return out(await ConsultSessionModel.findById(id).lean<Doc>());
}

/** Compare-and-set: apply only while the session is still in `from`. */
async function cas(id: string, from: ConsultSession["status"][], set: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<ConsultSession | null> {
  const { ConsultSessionModel } = await M();
  return out(await ConsultSessionModel.findOneAndUpdate({ _id: id, status: { $in: from }, ...extra }, { $set: set, $inc: { version: 1 } }, { new: true }).lean<Doc>());
}

async function bumpVersion(id: string, set: Record<string, unknown>) {
  const { ConsultSessionModel } = await M();
  return out(await ConsultSessionModel.findOneAndUpdate({ _id: id }, { $set: set, $inc: { version: 1 } }, { new: true }).lean<Doc>());
}

async function systemMessage(s: ConsultSession, text: string): Promise<void> {
  const { ConsultSessionModel, ConsultMessageModel } = await M();
  const bumped = await ConsultSessionModel.findOneAndUpdate({ _id: s.id }, { $inc: { msgSeq: 1, version: 1 } }, { new: true }).lean<Doc>();
  if (!bumped) return;
  await ConsultMessageModel.create({ sessionId: s.id, seq: bumped.msgSeq as number, from: "system", text, at: nowIso() }).catch(() => undefined);
}

async function balancePaise(customerId: string): Promise<number> {
  const w = await wallet();
  const b = await w.balance(customerId);
  return b.cashPaise + b.promoPaise;
}

/** Has this customer ever had a paid / completed consultation? (first-session offer) */

function isDup(e: unknown, field: string) {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

/* ============================================================ *
 * Billing
 * ============================================================ */

/**
 * Charge every minute that has started (up to `until`) and is not charged
 * yet. Ends the session when the wallet cannot pay the next minute.
 */
async function bill(s: ConsultSession, until = Date.now()): Promise<ConsultSession> {
  if (s.status !== "active" || !s.billFrom) return s;
  const start = Date.parse(s.billFrom);
  // The customer counts as present until PRESENT_MS after their last poll. A
  // minute that starts at or after that moment is never charged (benefit of
  // the doubt goes to the customer). Minute 1 is always due once billing starts.
  const present = s.lastSeen.customer ? Math.max(Date.parse(s.lastSeen.customer) + PRESENT_MS, start + 1) : start + 1;
  let cur = s;
  const before = s.minutesCharged;
  for (let guard = 0; guard < 240; guard++) {
    const k = cur.minutesCharged;
    const slotStart = start + k * 60_000;
    if (slotStart > until || slotStart >= present) break;
    const ratePaise = Math.round(cur.rate * 100);
    let paid = 0, free = 0;
    if (k < cur.freeMinutes) free = 1;
    else {
      const w = await wallet();
      const r = await w.charge(cur.customerId, `consult:${cur.id}:m${k}`, ratePaise, cur.id, `Chat with ${cur.astrologer.name} · minute ${k + 1}`);
      if (r.status === "insufficient") return (await endSession(cur, "low_balance", "System", new Date(slotStart).toISOString())) ?? cur;
      paid = ratePaise;
    }
    const { ConsultSessionModel } = await M();
    const next = out(await ConsultSessionModel.findOneAndUpdate(
      { _id: cur.id, status: "active", minutesCharged: k },
      { $inc: { minutesCharged: 1, freeUsed: free, chargedPaise: paid, version: 1 } },
      { new: true },
    ).lean<Doc>());
    // Someone else counted this minute (the wallet key made the charge a no-op): re-read.
    cur = next ?? (await get(cur.id)) ?? cur;
    if (cur.status !== "active") return cur;
  }
  // Low-balance flag: less than 2 minutes of money left (free minutes count as money).
  // Re-checked only when a minute was just counted (the balance only drops then).
  if (cur.minutesCharged === before) return cur;
  const bal = await balancePaise(cur.customerId);
  const freeLeft = Math.max(0, cur.freeMinutes - cur.minutesCharged);
  const low = freeLeft < 2 && bal < Math.round(cur.rate * 100) * (2 - freeLeft);
  if (low !== cur.lowBalance) {
    cur = (await bumpVersion(cur.id, { lowBalance: low })) ?? cur;
    if (low) await systemMessage(cur, "Balance is low: about 2 minutes left. Recharge to keep chatting.");
  }
  return cur;
}

/* ============================================================ *
 * End
 * ============================================================ */

const END_TEXT: Record<EndReason, string> = {
  customer: "The customer ended the chat.", astrologer: "The astrologer ended the chat.", low_balance: "Chat ended: wallet balance ran out.",
  customer_left: "Chat ended: the customer was disconnected.", astrologer_left: "Chat ended: the astrologer was disconnected. You are not charged for time after that.",
  no_reply: "Chat ended: the astrologer did not reply in time. You were not charged.", declined: "The astrologer could not take this chat.",
  missed: "The astrologer did not respond.", cancelled: "Request cancelled.", admin: "Chat ended by AstroUnkle support.", insufficient: "Not enough wallet balance to start.",
};

async function endSession(s: ConsultSession, reason: EndReason, actor: string, at = nowIso()): Promise<ConsultSession | null> {
  // Final bill up to now (only minutes that already started are charged).
  let cur = s;
  if (cur.status === "active" && reason !== "low_balance") cur = await bill(cur, Date.parse(at));
  if (cur.status !== "active" && cur.status !== "requested") return cur;
  const status: ConsultSession["status"] = cur.status === "requested" ? (reason === "declined" ? "declined" : reason === "missed" ? "missed" : "cancelled") : "ended";
  // Paid minutes after commission, plus what the platform pays for free (offer) minutes.
  const freePay = cur.freeUsed > 0 && (cur.freePayPct ?? 0) > 0
    ? cur.freeUsed * Math.floor((Math.round(cur.rate * 100) * (100 - cur.commissionPct) * (cur.freePayPct ?? 0)) / 10_000)
    : 0;
  const earning = Math.floor((cur.chargedPaise * (100 - cur.commissionPct)) / 100) + freePay;
  const done = await cas(cur.id, [cur.status], {
    status, endReason: reason, endedAt: at, openAstro: null, openCustomer: null,
    earningPaise: earning, platformPaise: cur.chargedPaise - earning,
  });
  if (!done) return get(cur.id);
  await systemMessage(done, END_TEXT[reason]);
  await astrologerService.setBusy(done.astrologerId, null).catch(() => undefined);
  // The astrologer is free again: give the next person in line their turn.
  try { const { offerNext } = await import("./consult.waitlist"); await offerNext(done.astrologerId); } catch { /* the sweep retries */ }
  if (status === "ended" && done.freeUsed > 0) {
    try { const { firstChatOffer } = await import("./consult.offer"); await firstChatOffer.recordUse(done); } catch { /* eligibility also checks past sessions */ }
  }
  if (status === "ended" && done.earningPaise > 0) {
    // Earnings ledger (idempotent; the reconcile sweep also catches a miss).
    try {
      const { earningsLedger } = await import("@/modules/earnings");
      await earningsLedger.consultation({ id: done.id, sessionNumber: done.sessionNumber, astrologerId: done.astrologerId, chargedPaise: done.chargedPaise, earningPaise: done.earningPaise, endedAt: done.endedAt, customerName: done.customer.name });
    } catch { /* reconciled later */ }
  }
  if (status === "ended" && done.minutesCharged > 0) {
    const { ConsultSessionModel } = await M();
    const repeat = (await ConsultSessionModel.countDocuments({ customerId: done.customerId, astrologerId: done.astrologerId, status: "ended", minutesCharged: { $gt: 0 } })) === 2 ? 1 : 0;
    await astrologerService.bumpStats(done.astrologerId, { sessions: 1, minutes: done.minutesCharged, repeat }).catch(() => undefined);
  }
  if (status === "missed") await astrologerService.recordMissed(done.astrologerId).catch(() => undefined);
  if (actor !== "System" || done.chargedPaise > 0) {
    await auditService.record({ action: "status", entity: "consultation", entityId: done.id, entityLabel: done.sessionNumber, summary: `Chat ${done.sessionNumber} ${status} (${reason}) · ${done.minutesCharged} min · ₹${done.chargedPaise / 100}`, actor }).catch(() => undefined);
  }
  return done;
}

/* ============================================================ *
 * Sweep: timeouts, disconnects, billing for idle polls
 * ============================================================ */

async function sweepOne(s: ConsultSession): Promise<ConsultSession> {
  const st = await astroSettingsService.get();
  const now = Date.now();
  if (s.status === "requested" && Date.parse(s.expiresAt) <= now) return (await endSession(s, "missed", "System")) ?? s;
  if (s.status !== "active") return s;
  if (!s.firstReplyAt && s.acceptedAt && Date.parse(s.acceptedAt) + st.joinTimeoutSec * 1000 <= now) return (await endSession(s, "no_reply", "System")) ?? s;
  const idle = st.idleTimeoutSec * 1000;
  const cSeen = s.lastSeen.customer ? Date.parse(s.lastSeen.customer) : Date.parse(s.acceptedAt ?? s.requestedAt);
  const aSeen = s.lastSeen.astrologer ? Date.parse(s.lastSeen.astrologer) : Date.parse(s.acceptedAt ?? s.requestedAt);
  if (now - aSeen > idle) return (await endSession(s, "astrologer_left", "System", new Date(aSeen + PRESENT_MS).toISOString())) ?? s;
  if (now - cSeen > idle) return (await endSession(s, "customer_left", "System", new Date(cSeen + PRESENT_MS).toISOString())) ?? s;
  return bill(s);
}

export async function sweepConsultations(): Promise<{ checked: number }> {
  const { ConsultSessionModel } = await M();
  const rows = await ConsultSessionModel.find({ status: { $in: OPEN } }).limit(200).lean<Doc[]>();
  for (const r of rows) { const s = out(r); if (s) await sweepOne(s).catch(() => undefined); }
  try { const { sweepWaitlists } = await import("./consult.waitlist"); await sweepWaitlists(); } catch { /* best effort */ }
  return { checked: rows.length };
}

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
export function maybeSweepConsultations(everyMs = 10_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  sweeping = sweepConsultations().catch(() => undefined).finally(() => { sweeping = null; });
}

/* ============================================================ *
 * Views (role-specific, safe)
 * ============================================================ */

export interface SessionView {
  id: string; sessionNumber: string; status: ConsultSession["status"]; endReason: EndReason | null; endText: string | null;
  role: ConsultRole;
  astrologer: { id: string; name: string; photo: string | null; slug: string };
  customer: { name: string; intake: ConsultSession["intake"] | null };
  question: string;
  rate: number; freeMinutes: number; minutesCharged: number; freeUsed: number;
  /** Customer: ₹ spent. Astrologer: ₹ earned so far. */
  amountPaise: number;
  billing: "waiting_reply" | "running" | "stopped";
  billFrom: string | null;
  requestedAt: string; expiresAt: string; acceptedAt: string | null; endedAt: string | null;
  otherTyping: boolean; otherReadSeq: number; otherOnline: boolean;
  lowBalance: boolean;
  /** Customer only: wallet balance and whole minutes it still pays for. */
  balancePaise: number | null; minutesLeft: number | null;
  rating: ConsultSession["rating"];
  canRate: boolean;
  /** Tips given on this chat (customer: paid, astrologer: received). */
  tipPaise: number;
  /** Customer only: tip quick amounts (₹) while a tip can still be added, else null. */
  tipOptions: { presets: number[]; maxPaise: number } | null;
  version: number; msgSeq: number;
  serverNow: string;
}

async function view(s: ConsultSession, role: ConsultRole): Promise<SessionView> {
  const other: ConsultRole = role === "customer" ? "astrologer" : "customer";
  const now = Date.now();
  const bal = role === "customer" && OPEN.includes(s.status) ? await balancePaise(s.customerId) : null;
  const ratePaise = Math.round(s.rate * 100);
  const freeLeft = Math.max(0, s.freeMinutes - s.minutesCharged);
  return {
    id: s.id, sessionNumber: s.sessionNumber, status: s.status, endReason: s.endReason, endText: s.endReason ? END_TEXT[s.endReason] : null, role,
    astrologer: { id: s.astrologerId, ...s.astrologer },
    // The astrologer sees the birth details the customer shared; the customer sees nothing extra.
    customer: { name: s.customer.name, intake: role === "astrologer" ? s.intake : null },
    question: s.question,
    rate: s.rate, freeMinutes: s.freeMinutes, minutesCharged: s.minutesCharged, freeUsed: s.freeUsed,
    amountPaise: role === "customer" ? s.chargedPaise - s.refundedPaise : s.status === "ended" ? s.earningPaise : Math.floor((s.chargedPaise * (100 - s.commissionPct)) / 100),
    billing: s.status !== "active" ? "stopped" : s.billFrom ? "running" : "waiting_reply",
    billFrom: s.billFrom,
    requestedAt: s.requestedAt, expiresAt: s.expiresAt, acceptedAt: s.acceptedAt, endedAt: s.endedAt,
    otherTyping: Boolean(s.typing[other] && now - Date.parse(s.typing[other]!) < TYPING_MS),
    otherReadSeq: s.read[other] ?? 0,
    otherOnline: Boolean(s.lastSeen[other] && now - Date.parse(s.lastSeen[other]!) < PRESENT_MS),
    lowBalance: role === "customer" ? s.lowBalance : false,
    balancePaise: bal,
    minutesLeft: bal === null ? null : freeLeft + (ratePaise > 0 ? Math.floor(bal / ratePaise) : 0),
    rating: s.rating,
    canRate: role === "customer" && s.status === "ended" && !s.rating && s.minutesCharged > 0 && Date.now() - Date.parse(s.endedAt ?? s.requestedAt) < 7 * 86_400_000,
    tipPaise: s.tipPaise ?? 0,
    tipOptions: role === "customer" ? await tipOptionsFor(s) : null,
    version: s.version, msgSeq: s.msgSeq,
    serverNow: new Date(now).toISOString(),
  };
}

/** Tips: on, chat ended with paid time, inside the window, and under the per-chat cap. */
async function tipOptionsFor(s: ConsultSession): Promise<{ presets: number[]; maxPaise: number } | null> {
  if (s.status !== "ended" || s.minutesCharged - s.freeUsed <= 0 || !s.endedAt) return null;
  const st = await astroSettingsService.get();
  if (!st.tips.enabled || Date.now() - Date.parse(s.endedAt) > st.tips.windowHours * 3600_000) return null;
  const left = st.tips.maxPerChat * 100 - (s.tipPaise ?? 0);
  if (left < 100) return null;
  return { presets: st.tips.presets.filter((p) => p * 100 <= left), maxPaise: left };
}

function roleOf(s: ConsultSession, who: { customerId?: string; astrologerId?: string }): ConsultRole | null {
  if (who.customerId && s.customerId === who.customerId) return "customer";
  if (who.astrologerId && s.astrologerId === who.astrologerId) return "astrologer";
  return null;
}

async function touch(s: ConsultSession, role: ConsultRole): Promise<ConsultSession> {
  const last = s.lastSeen[role] ? Date.parse(s.lastSeen[role]!) : 0;
  if (Date.now() - last < 5_000 || !OPEN.includes(s.status)) return s;
  const { ConsultSessionModel } = await M();
  // Presence is not a "change" for long-poll purposes: no version bump.
  const d = await ConsultSessionModel.findOneAndUpdate({ _id: s.id }, { $set: { [`lastSeen.${role}`]: nowIso() } }, { new: true }).lean<Doc>();
  return out(d) ?? s;
}

/* ============================================================ *
 * Public API
 * ============================================================ */

export const consultService = {
  /** Customer asks an online astrologer for a chat. Idempotent on requestId. */
  async request(customerId: string, input: { astrologerId: string; requestId: string; question?: string }): Promise<Result<SessionView>> {
    const { ConsultSessionModel, ConsultBlockModel } = await M();
    const again = out(await ConsultSessionModel.findOne({ requestId: input.requestId }).lean<Doc>());
    if (again) return again.customerId === customerId ? ok(await view(again, "customer")) : fail(AppErrors.conflict("This request was already used."));

    const open = out(await ConsultSessionModel.findOne({ openCustomer: customerId }).lean<Doc>());
    if (open) {
      const fresh = await sweepOne(open);
      if (OPEN.includes(fresh.status)) {
        if (fresh.astrologerId === input.astrologerId) return ok(await view(fresh, "customer"));
        return fail(AppErrors.conflict("You already have a chat in progress. Finish it before starting another.", { reason: "OPEN_CHAT", sessionId: fresh.id }));
      }
    }

    const st = await astroSettingsService.get();
    const a = await astrologerService.getInternal(input.astrologerId);
    if (!a || a.status !== "approved" || a.hidden) return fail(AppErrors.notFound("This astrologer is not available"));
    if (!isOnline(a, st) || !a.presence.channels.chat || a.rates.chat <= 0) return fail(AppErrors.validation(`${a.displayName} is offline for chat right now. Please try another astrologer.`, { reason: "OFFLINE" }));
    {
      // Live for everyone right now: one-to-one chats wait; send the customer to the live instead.
      const { liveOf } = await import("@/modules/live");
      const liveId = await liveOf(a.id).catch(() => null);
      if (liveId) return fail(AppErrors.validation(`${a.displayName} is live right now. Join the live to ask your question.`, { reason: "LIVE", liveId }));
    }
    {
      // People are waiting in line: be fair, join the line (the offered customer passes).
      const { queueGate } = await import("./consult.waitlist");
      const g = await queueGate(a.id, customerId, input.requestId).catch(() => ({ allowed: true as const }));
      if (!g.allowed) return fail(AppErrors.conflict(`${a.displayName} has ${g.waiting} ${g.waiting === 1 ? "person" : "people"} waiting. Join the waitlist to get your turn.`, { reason: "QUEUE", waiting: g.waiting }));
    }
    if (await ConsultBlockModel.exists({ astrologerId: a.id, customerId })) return fail(AppErrors.validation(`${a.displayName} is not taking chats right now. Please try another astrologer.`, { reason: "OFFLINE" }));

    const { customerService } = await import("@/modules/customers");
    const c = await customerService.getById(customerId);
    if (!c.ok) return fail(AppErrors.unauthorized("Please sign in again"));
    const rate = a.rates.chat;
    // First-chat offer: new customer (one per phone, ever) with an astrologer who takes offer chats.
    const { firstChatOffer } = await import("./consult.offer");
    const freeMinutes = st.firstSessionFreeMinutes > 0 && (await firstChatOffer.takes(a.id, rate)) && (await firstChatOffer.eligible(customerId)) ? st.firstSessionFreeMinutes : 0;
    const need = Math.max(0, st.minStartMinutes - freeMinutes) * Math.round(rate * 100);
    const bal = await balancePaise(customerId);
    if (bal < need) return fail(AppErrors.validation(`You need at least ₹${need / 100} (${st.minStartMinutes} minutes) in your wallet to start this chat.`, { reason: "LOW_BALANCE", needPaise: need, balancePaise: bal }));

    let intake: ConsultSession["intake"] = null;
    try {
      const { astroProfileService } = await import("@/modules/astro-profiles");
      const p = await astroProfileService.getPrimary(customerId);
      if (p.ok && p.value) intake = { name: p.value.fullName, dob: p.value.dob, birthTime: p.value.birthTime ?? "", birthPlace: p.value.birthPlace ?? "", gender: p.value.gender ?? "" };
    } catch { /* intake is optional */ }

    const now = new Date();
    const question = maskContacts((input.question ?? "").trim().slice(0, 500)).text;
    try {
      const d = await ConsultSessionModel.create({
        sessionNumber: `CS-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        requestId: input.requestId, channel: "chat", status: "requested",
        customerId, customer: { name: (c.value.name || "Customer").split(" ")[0].slice(0, 40) },
        astrologerId: a.id, astrologer: { name: a.displayName, photo: a.photo ?? null, slug: a.slug },
        intake, question, rate, commissionPct: a.commissionPct ?? st.commissionPct, freeMinutes, freePayPct: freeMinutes ? st.firstChat.astrologerPayPct : 0,
        openAstro: a.id, openCustomer: customerId,
        requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + st.requestTimeoutSec * 1000).toISOString(),
        lastSeen: { customer: now.toISOString() }, typing: {}, read: {}, msgSeq: 0, reports: [], version: 1,
      });
      const s = out(d.toObject() as Doc)!;
      await astrologerService.setBusy(a.id, s.id).catch(() => undefined);
      return ok(await view(s, "customer"));
    } catch (e) {
      if (isDup(e, "requestId")) {
        const ex = out(await ConsultSessionModel.findOne({ requestId: input.requestId }).lean<Doc>());
        return ex && ex.customerId === customerId ? ok(await view(ex, "customer")) : fail(AppErrors.conflict("Please try again."));
      }
      if (isDup(e, "openAstro")) return fail(AppErrors.conflict(`${a.displayName} is in another consultation. Please try again in a few minutes or pick another astrologer.`, { reason: "BUSY" }));
      if (isDup(e, "openCustomer")) return fail(AppErrors.conflict("You already have a chat in progress.", { reason: "OPEN_CHAT" }));
      if (isDup(e, "sessionNumber")) return fail(AppErrors.conflict("Please try again."));
      throw e;
    }
  },

  /** The customer's open session (to resume after the app was closed). */
  async active(customerId: string): Promise<Result<SessionView | null>> {
    const { ConsultSessionModel } = await M();
    const s = out(await ConsultSessionModel.findOne({ openCustomer: customerId }).lean<Doc>());
    if (!s) return ok(null);
    const fresh = await sweepOne(s);
    return ok(OPEN.includes(fresh.status) ? await view(fresh, "customer") : null);
  },

  /** Astrologer inbox: waiting requests + the live session. */
  async inbox(astrologerId: string): Promise<{ requests: SessionView[]; active: SessionView | null }> {
    const { ConsultSessionModel } = await M();
    const rows = (await ConsultSessionModel.find({ astrologerId, status: { $in: OPEN } }).sort({ requestedAt: 1 }).lean<Doc[]>()).map(out).filter(Boolean) as ConsultSession[];
    const fresh: ConsultSession[] = [];
    for (const r of rows) fresh.push(await sweepOne(r));
    const req = fresh.filter((s) => s.status === "requested");
    const act = fresh.find((s) => s.status === "active") ?? null;
    return { requests: await Promise.all(req.map((s) => view(s, "astrologer"))), active: act ? await view(await touch(act, "astrologer"), "astrologer") : null };
  },

  async accept(astrologerId: string, id: string): Promise<Result<SessionView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Request not found"));
    if (s.status === "active") return ok(await view(s, "astrologer"));
    if (s.status !== "requested") return fail(AppErrors.validation("This request is no longer waiting (it was cancelled or timed out)."));
    if (Date.parse(s.expiresAt) <= Date.now()) { await endSession(s, "missed", "System"); return fail(AppErrors.validation("This request timed out.")); }
    const st = await astroSettingsService.get();
    const need = Math.max(0, st.minStartMinutes - s.freeMinutes) * Math.round(s.rate * 100);
    if ((await balancePaise(s.customerId)) < need) { await endSession(s, "insufficient", "System"); return fail(AppErrors.validation("The customer no longer has enough wallet balance. The request was closed.")); }
    const at = nowIso();
    const done = await cas(id, ["requested"], { status: "active", acceptedAt: at, billFrom: st.billFromFirstReply ? null : at, "lastSeen.astrologer": at });
    if (!done) { const cur = await get(id); return cur?.status === "active" ? ok(await view(cur, "astrologer")) : fail(AppErrors.validation("This request is no longer waiting.")); }
    await systemMessage(done, `${done.astrologer.name} joined the chat.${st.billFromFirstReply ? " Billing starts with their first reply." : ""}`);
    return ok(await view((await get(id)) ?? done, "astrologer"));
  },

  async decline(astrologerId: string, id: string): Promise<Result<SessionView>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Request not found"));
    if (s.status !== "requested") return ok(await view(s, "astrologer"));
    const done = await endSession(s, "declined", "Astrologer");
    return ok(await view(done ?? s, "astrologer"));
  },

  /** Customer withdraws a request that was not accepted yet. */
  async cancel(customerId: string, id: string): Promise<Result<SessionView>> {
    const s = await get(id);
    if (!s || s.customerId !== customerId) return fail(AppErrors.notFound("Chat not found"));
    if (s.status === "active") return fail(AppErrors.validation("The astrologer already joined. Use End chat."));
    if (s.status !== "requested") return ok(await view(s, "customer"));
    return ok(await view((await endSession(s, "cancelled", "Customer")) ?? s, "customer"));
  },

  async end(who: { customerId?: string; astrologerId?: string }, id: string): Promise<Result<SessionView>> {
    const s = await get(id);
    const role = s ? roleOf(s, who) : null;
    if (!s || !role) return fail(AppErrors.notFound("Chat not found"));
    if (s.status === "requested" && role === "customer") return this.cancel(who.customerId!, id);
    if (s.status !== "active") return ok(await view(s, role));
    return ok(await view((await endSession(s, role === "customer" ? "customer" : "astrologer", role === "customer" ? "Customer" : "Astrologer")) ?? s, role));
  },

  /**
   * Send a message. `card` is only ever built on the server (remedy
   * suggestions); the HTTP route never passes one from the client.
   */
  async send(who: { customerId?: string; astrologerId?: string }, id: string, text: string, clientId: string, card?: ConsultCard): Promise<Result<ConsultMessage>> {
    const s0 = await get(id);
    const role = s0 ? roleOf(s0, who) : null;
    if (!s0 || !role) return fail(AppErrors.notFound("Chat not found"));
    const st = await astroSettingsService.get();
    let s = await sweepOne(s0);
    if (s.status !== "active") return fail(AppErrors.validation(s.status === "requested" ? "Wait for the astrologer to join." : "This chat has ended.", { reason: "NOT_ACTIVE" }));
    const clean = text.replace(/\s+$/g, "").slice(0, 2000);
    if (!clean.trim()) return fail(AppErrors.validation("Type a message"));
    const { ConsultSessionModel, ConsultMessageModel } = await M();
    const dup = await ConsultMessageModel.findOne({ sessionId: id, clientId }).lean<Doc>();
    if (dup) return ok(msgOut(dup));
    const m = st.maskContactInfo && !card ? maskContacts(clean) : { text: clean, masked: false };
    const at = nowIso();
    // First astrologer reply starts the meter.
    const firstReply = role === "astrologer" && !s.firstReplyAt;
    const bumped = out(await ConsultSessionModel.findOneAndUpdate(
      { _id: id, status: "active" },
      { $inc: { msgSeq: 1, version: 1 }, $set: { [`lastSeen.${role}`]: at, [`typing.${role}`]: null, [`read.${role}`]: s.msgSeq + 1, ...(firstReply ? { firstReplyAt: at, ...(s.billFrom ? {} : { billFrom: at }) } : {}) } },
      { new: true },
    ).lean<Doc>());
    if (!bumped) return fail(AppErrors.validation("This chat has ended.", { reason: "NOT_ACTIVE" }));
    try {
      const d = await ConsultMessageModel.create({ sessionId: id, seq: bumped.msgSeq, from: role, text: m.text, masked: m.masked, clientId, at, ...(card ? { card } : {}) });
      s = bumped;
      if (firstReply) await bill(s);
      return ok(msgOut(d.toObject() as Doc));
    } catch (e) {
      if (isDup(e, "clientId")) { const x = await ConsultMessageModel.findOne({ sessionId: id, clientId }).lean<Doc>(); if (x) return ok(msgOut(x)); }
      throw e;
    }
  },

  async typing(who: { customerId?: string; astrologerId?: string }, id: string): Promise<void> {
    const s = await get(id);
    const role = s ? roleOf(s, who) : null;
    if (!s || !role || s.status !== "active") return;
    await bumpVersion(id, { [`typing.${role}`]: nowIso(), [`lastSeen.${role}`]: nowIso() });
  },

  async read(who: { customerId?: string; astrologerId?: string }, id: string, seq: number): Promise<void> {
    const s = await get(id);
    const role = s ? roleOf(s, who) : null;
    if (!s || !role || (s.read[role] ?? 0) >= seq) return;
    await bumpVersion(id, { [`read.${role}`]: Math.min(seq, s.msgSeq) });
  },

  /**
   * Long-poll: returns at once when the session changed (version ≠ v) or new
   * messages after `after` exist; otherwise waits up to `waitMs`. Also keeps
   * the caller's presence fresh and runs the timers / billing.
   */
  async events(who: { customerId?: string; astrologerId?: string }, id: string, after: number, v: number, waitMs: number): Promise<Result<{ session: SessionView; messages: ConsultMessage[] }>> {
    let s = await get(id);
    const role = s ? roleOf(s, who) : null;
    if (!s || !role) return fail(AppErrors.notFound("Chat not found"));
    const { ConsultMessageModel } = await M();
    const until = Date.now() + Math.min(Math.max(waitMs, 0), 20_000);
    for (;;) {
      s = await touch(s!, role);
      s = await sweepOne(s);
      const changed = s.version !== v || s.msgSeq > after;
      if (changed || Date.now() >= until) {
        const msgs = s.msgSeq > after ? (await ConsultMessageModel.find({ sessionId: id, seq: { $gt: after } }).sort({ seq: 1 }).limit(200).lean<Doc[]>()).map(msgOut) : [];
        return ok({ session: await view(s, role), messages: msgs });
      }
      await new Promise((r) => setTimeout(r, 900));
      s = (await get(id)) ?? s;
    }
  },

  async rate(customerId: string, id: string, stars: number, text: string): Promise<Result<SessionView>> {
    const s = await get(id);
    if (!s || s.customerId !== customerId) return fail(AppErrors.notFound("Chat not found"));
    if (s.rating) return ok(await view(s, "customer"));
    const v = await view(s, "customer");
    if (!v.canRate) return fail(AppErrors.validation("This chat cannot be rated."));
    const st = await astroSettingsService.get();
    const rating = { stars, text: maskContacts(text.trim().slice(0, 500)).text, at: nowIso(), status: st.moderateReviews ? "pending" : "approved" };
    const done = await bumpVersion(id, { rating });
    if (rating.status === "approved") await recomputeRating(s.astrologerId);
    return ok(await view(done ?? s, "customer"));
  },

  /**
   * Tip after a chat, paid from the wallet, 100% to the astrologer.
   * Idempotent on requestId (wallet key + session push are both guarded).
   */
  async tip(customerId: string, id: string, amountPaise: number, requestId: string): Promise<Result<SessionView>> {
    const s = await get(id);
    if (!s || s.customerId !== customerId) return fail(AppErrors.notFound("Chat not found"));
    if ((s.tips ?? []).some((t) => t.requestId === requestId)) return ok(await view(s, "customer"));
    const opt = await tipOptionsFor(s);
    if (!opt) return fail(AppErrors.validation("A tip cannot be added to this chat.", { reason: "TIP_CLOSED" }));
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise % 100 !== 0) return fail(AppErrors.validation("Enter a whole rupee amount, ₹1 or more."));
    if (amountPaise > opt.maxPaise) return fail(AppErrors.validation(`The most you can tip on this chat is ₹${opt.maxPaise / 100}.`));
    const w = await wallet();
    const r = await w.charge(customerId, `tip:${id}:${requestId}`, amountPaise, id, `Tip for ${s.astrologer.name} · chat ${s.sessionNumber}`);
    if (r.status === "insufficient") return fail(AppErrors.validation(`Not enough wallet balance for a ₹${amountPaise / 100} tip.`, { reason: "LOW_BALANCE", needPaise: amountPaise, balancePaise: r.balance.cashPaise + r.balance.promoPaise }));
    const at = nowIso();
    const { ConsultSessionModel } = await M();
    const done = out(await ConsultSessionModel.findOneAndUpdate(
      { _id: id, "tips.requestId": { $ne: requestId } },
      { $inc: { tipPaise: amountPaise, version: 1 }, $push: { tips: { requestId, amountPaise, at } } },
      { new: true },
    ).lean<Doc>());
    const cur = done ?? (await get(id)) ?? s;
    if (done) {
      await systemMessage(done, `${done.customer.name} sent a tip of ₹${amountPaise / 100}. Thank you.`);
      try {
        const { earningsLedger } = await import("@/modules/earnings");
        await earningsLedger.tip({ sessionId: id, sessionNumber: s.sessionNumber, requestId, astrologerId: s.astrologerId, amountPaise, from: s.customer.name, at });
      } catch { /* reconciled below */ }
    }
    return ok(await view(cur, "customer"));
  },

  async report(who: { customerId?: string; astrologerId?: string }, id: string, reason: string): Promise<Result<{ ok: true }>> {
    const s = await get(id);
    const role = s ? roleOf(s, who) : null;
    if (!s || !role) return fail(AppErrors.notFound("Chat not found"));
    const { ConsultSessionModel } = await M();
    await ConsultSessionModel.updateOne({ _id: id }, { $push: { reports: { by: role, reason: reason.trim().slice(0, 500), at: nowIso() } } });
    await auditService.record({ action: "update", entity: "consultation", entityId: id, entityLabel: s.sessionNumber, summary: `Chat ${s.sessionNumber} reported by the ${role}: ${reason.trim().slice(0, 120)}`, actor: role === "customer" ? "Customer" : "Astrologer" }).catch(() => undefined);
    return ok({ ok: true });
  },

  /** Astrologer blocks the customer from future chats (and ends the current one). */
  async block(astrologerId: string, id: string, reason: string): Promise<Result<{ ok: true }>> {
    const s = await get(id);
    if (!s || s.astrologerId !== astrologerId) return fail(AppErrors.notFound("Chat not found"));
    const { ConsultBlockModel } = await M();
    await ConsultBlockModel.updateOne({ astrologerId, customerId: s.customerId }, { $set: { reason: reason.slice(0, 300), at: nowIso(), via: "chat", name: s.customer?.name ?? "" } }, { upsert: true });
    if (OPEN.includes(s.status)) await endSession(s, s.status === "requested" ? "declined" : "astrologer", "Astrologer");
    return ok({ ok: true });
  },

  async history(who: { customerId?: string; astrologerId?: string }, limit = 50): Promise<SessionView[]> {
    const { ConsultSessionModel } = await M();
    const q = who.customerId ? { customerId: who.customerId } : { astrologerId: who.astrologerId };
    const rows = (await ConsultSessionModel.find(q).sort({ requestedAt: -1 }).limit(Math.min(limit, 100)).lean<Doc[]>()).map(out).filter(Boolean) as ConsultSession[];
    return Promise.all(rows.map((s) => view(s, who.customerId ? "customer" : "astrologer")));
  },

  async transcript(who: { customerId?: string; astrologerId?: string }, id: string): Promise<Result<{ session: SessionView; messages: ConsultMessage[] }>> {
    return this.events(who, id, 0, -1, 0);
  },

  /* ---------- admin ---------- */

  async adminList(f: { status?: string; limit?: number }): Promise<ConsultSession[]> {
    const { ConsultSessionModel } = await M();
    const q = f.status === "live" ? { status: { $in: OPEN } } : f.status === "reported" ? { "reports.0": { $exists: true } } : f.status === "reviews" ? { "rating.status": "pending" } : {};
    return ((await ConsultSessionModel.find(q).sort({ requestedAt: -1 }).limit(Math.min(f.limit ?? 100, 200)).lean<Doc[]>()).map(out).filter(Boolean)) as ConsultSession[];
  },

  async adminGet(id: string): Promise<Result<{ session: ConsultSession; messages: ConsultMessage[] }>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Chat not found"));
    const { ConsultMessageModel } = await M();
    const messages = (await ConsultMessageModel.find({ sessionId: id }).sort({ seq: 1 }).limit(2000).lean<Doc[]>()).map(msgOut);
    return ok({ session: s, messages });
  },

  async adminEnd(id: string, adminName: string): Promise<Result<ConsultSession>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Chat not found"));
    if (!OPEN.includes(s.status)) return ok(s);
    return ok((await endSession(s, s.status === "requested" ? "cancelled" : "admin", adminName)) ?? s);
  },

  /** Refund part or all of what was charged, to the customer's wallet. Never more than charged. */
  async adminRefund(id: string, amountPaise: number, reason: string, adminName: string, requestId: string): Promise<Result<ConsultSession>> {
    const s = await get(id);
    if (!s) return fail(AppErrors.notFound("Chat not found"));
    if (OPEN.includes(s.status)) return fail(AppErrors.validation("End the chat before refunding."));
    const left = s.chargedPaise - s.refundedPaise;
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > left) return fail(AppErrors.validation(`Refund between ₹0.01 and ₹${left / 100}`));
    const { ConsultSessionModel } = await M();
    // Reserve the amount first (atomic), so two clicks cannot refund twice.
    const held = await ConsultSessionModel.findOneAndUpdate({ _id: id, refundedPaise: s.refundedPaise }, { $inc: { refundedPaise: amountPaise, version: 1 } }, { new: true }).lean<Doc>();
    if (!held) return fail(AppErrors.conflict("This chat was just updated. Reload and try again."));
    try {
      const w = await wallet();
      await w.refund(s.customerId, `consultrefund:${id}:${requestId}`, { cashPaise: amountPaise, promoPaise: 0 }, id, `Refund for chat ${s.sessionNumber}: ${reason}`, adminName);
    } catch (e) {
      await ConsultSessionModel.updateOne({ _id: id }, { $inc: { refundedPaise: -amountPaise, version: 1 } });
      return fail(AppErrors.internal(e instanceof Error ? e.message : "Refund failed"));
    }
    await auditService.record({ action: "refund", entity: "consultation", entityId: id, entityLabel: s.sessionNumber, summary: `Refunded ₹${amountPaise / 100} for chat ${s.sessionNumber}: ${reason}`, actor: adminName }).catch(() => undefined);
    // The astrologer's share of the refunded money comes back out of their earnings.
    try {
      const { earningsLedger } = await import("@/modules/earnings");
      await earningsLedger.refund({ sessionId: id, sessionNumber: s.sessionNumber, requestId, astrologerId: s.astrologerId, refundPaise: amountPaise, commissionPct: s.commissionPct, actor: adminName });
    } catch { /* reconciled later */ }
    return ok(out(held)!);
  },

  async moderateReview(id: string, approve: boolean): Promise<Result<ConsultSession>> {
    const s = await get(id);
    if (!s?.rating) return fail(AppErrors.notFound("Review not found"));
    const done = await bumpVersion(id, { "rating.status": approve ? "approved" : "rejected" });
    await recomputeRating(s.astrologerId);
    return ok(done ?? s);
  },

  newClientId: () => newId("cm"),
};

async function recomputeRating(astrologerId: string) {
  const { ConsultSessionModel } = await M();
  const r = await ConsultSessionModel.aggregate([{ $match: { astrologerId, "rating.status": "approved" } }, { $group: { _id: null, avg: { $avg: "$rating.stars" }, n: { $sum: 1 } } }]);
  await astrologerService.setRating(astrologerId, r[0]?.avg ?? 0, r[0]?.n ?? 0).catch(() => undefined);
}
