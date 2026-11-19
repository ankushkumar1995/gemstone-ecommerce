import "server-only";

/**
 * Astrologer earnings ledger + payouts. See earnings.types.ts for the rules.
 *
 * Money safety
 *   • Every ledger row has a unique `key`: the same event can never be counted
 *     twice, whether it comes from the live hook, the reconcile sweep or a retry.
 *   • A payout takes its amount from the balance in the same step it is created
 *     (ledger debit), and one astrologer can have only one open payout (unique
 *     `openKey`), so two clicks / two tabs cannot withdraw twice.
 *   • Rejected / failed / cancelled payouts put the money back with their own
 *     unique key (`payout-reversal:<id>`), so that also happens exactly once.
 *   • Status changes are compare-and-set on `status`.
 *   • RazorpayX calls carry our payout id as the idempotency key.
 */

import crypto from "node:crypto";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import { astrologerService } from "@/modules/astrologers";
import type { EarningsBalance, LedgerEntry, LedgerType, Payout, PayoutDestination, PayoutStatus } from "./earnings.types";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return import("./earnings.model");
}

const nowIso = () => new Date().toISOString();
const DAY = 86_400_000;
const EARNING_TYPES: LedgerType[] = ["consultation", "gift", "super_chat", "tip", "remedy", "remedy_reversal", "refund", "adjustment"];
const OPEN_PAYOUT: PayoutStatus[] = ["requested", "approved", "processing"];
const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function isDup(e: unknown, field: string) {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

const entryOut = (d: Doc): LedgerEntry => {
  const { _id, ...rest } = d;
  return { ...(rest as unknown as Omit<LedgerEntry, "id">), id: String(_id) };
};
const payoutOut = (d: Doc | null): Payout | null => {
  if (!d) return null;
  const { _id, openKey: _o, ...rest } = d;
  void _o;
  return { ...(rest as unknown as Omit<Payout, "id">), id: String(_id), history: (d.history as Payout["history"]) ?? [] };
};

async function holdUntil(fromIso: string): Promise<string> {
  const st = await astroSettingsService.get();
  return new Date(Date.parse(fromIso) + st.holdDays * DAY).toISOString();
}

/** Insert one ledger row. Returns false when this key was already recorded. */
async function record(e: Omit<LedgerEntry, "id">): Promise<boolean> {
  const { AstroLedgerModel } = await M();
  try {
    await AstroLedgerModel.create(e);
    return true;
  } catch (err) {
    if (isDup(err, "key")) return false;
    throw err;
  }
}

async function notify(astrologerId: string, title: string, body: string) {
  try {
    const { notifyPartner } = await import("@/modules/partner-notices");
    await notifyPartner(astrologerId, { kind: "system", title, body, link: "/astrologer/payouts" });
  } catch { /* never block money flow on a notification */ }
}

/* ============================================================ *
 * Ledger hooks (called by consultations / live / tips)
 * ============================================================ */

export const earningsLedger = {
  /** A finished paid chat. */
  async consultation(s: { id: string; sessionNumber: string; astrologerId: string; chargedPaise: number; earningPaise: number; endedAt: string | null; customerName: string }): Promise<void> {
    if (s.earningPaise <= 0) return;
    const at = s.endedAt ?? nowIso();
    await record({
      key: `consult:${s.id}`, astrologerId: s.astrologerId, type: "consultation",
      grossPaise: s.chargedPaise, commissionPaise: s.chargedPaise - s.earningPaise, netPaise: s.earningPaise,
      availableAt: await holdUntil(at), at, ref: { kind: "consultation", id: s.id, label: `Chat ${s.sessionNumber} with ${s.customerName}` }, note: "", actor: "System",
    });
  },

  /** A live gift (after commission). */
  async gift(g: { liveId: string; liveNumber: string; clientId: string; astrologerId: string; pricePaise: number; earningPaise: number; giftName: string; from: string; at?: string }): Promise<void> {
    const at = g.at ?? nowIso();
    await record({
      key: `gift:${g.liveId}:${g.clientId}`, astrologerId: g.astrologerId, type: "gift",
      grossPaise: g.pricePaise, commissionPaise: g.pricePaise - g.earningPaise, netPaise: g.earningPaise,
      availableAt: await holdUntil(at), at, ref: { kind: "live", id: g.liveId, label: `${g.giftName} from ${g.from} · live ${g.liveNumber}` }, note: "", actor: "System",
    });
  },

  /** A Super Chat the astrologer answered on a live (after commission). */
  async superChat(x: { queueId: string; liveId: string; liveNumber: string; astrologerId: string; pricePaise: number; earningPaise: number; from: string; at?: string }): Promise<void> {
    const at = x.at ?? nowIso();
    await record({
      key: `superchat:${x.queueId}`, astrologerId: x.astrologerId, type: "super_chat",
      grossPaise: x.pricePaise, commissionPaise: x.pricePaise - x.earningPaise, netPaise: x.earningPaise,
      availableAt: await holdUntil(at), at, ref: { kind: "live", id: x.liveId, label: `Super Chat from ${x.from} · live ${x.liveNumber}` }, note: "", actor: "System",
    });
  },

  /** A tip after a chat: 100% to the astrologer. */
  async tip(t: { sessionId: string; sessionNumber: string; requestId: string; astrologerId: string; amountPaise: number; from: string; at?: string }): Promise<void> {
    const at = t.at ?? nowIso();
    await record({
      key: `tip:${t.sessionId}:${t.requestId}`, astrologerId: t.astrologerId, type: "tip",
      grossPaise: t.amountPaise, commissionPaise: 0, netPaise: t.amountPaise,
      availableAt: await holdUntil(at), at, ref: { kind: "consultation", id: t.sessionId, label: `Tip from ${t.from} · chat ${t.sessionNumber}` }, note: "", actor: "System",
    });
  },

  /**
   * Commission on a remedy sale. Written only once the return / complaint
   * window is over, so it is withdrawable at once. Returns false when it was already recorded.
   */
  async remedy(r: { saleId: string; astrologerId: string; basePaise: number; commissionPaise: number; label: string; note: string; at?: string }): Promise<boolean> {
    if (r.commissionPaise <= 0) return false;
    const at = r.at ?? nowIso();
    return record({
      key: `remedy:${r.saleId}`, astrologerId: r.astrologerId, type: "remedy",
      grossPaise: r.commissionPaise, commissionPaise: 0, netPaise: r.commissionPaise,
      availableAt: at, at, ref: { kind: "remedy", id: r.saleId, label: r.label }, note: r.note, actor: "System",
    });
  },

  /** A confirmed remedy sale was refunded or cancelled later: take the commission back (once). */
  async remedyReversal(r: { saleId: string; astrologerId: string; commissionPaise: number; label: string; note: string; actor: string }): Promise<boolean> {
    if (r.commissionPaise <= 0) return false;
    const at = nowIso();
    return record({
      key: `remedy-rev:${r.saleId}`, astrologerId: r.astrologerId, type: "remedy_reversal",
      grossPaise: r.commissionPaise, commissionPaise: 0, netPaise: -r.commissionPaise,
      availableAt: at, at, ref: { kind: "remedy", id: r.saleId, label: r.label }, note: r.note, actor: r.actor,
    });
  },

  /** The astrologer's share of a customer refund comes back out of their balance (at once). */
  async refund(r: { sessionId: string; sessionNumber: string; requestId: string; astrologerId: string; refundPaise: number; commissionPct: number; actor: string }): Promise<void> {
    const share = Math.floor((r.refundPaise * (100 - r.commissionPct)) / 100);
    if (share <= 0) return;
    const at = nowIso();
    await record({
      key: `refund:${r.sessionId}:${r.requestId}`, astrologerId: r.astrologerId, type: "refund",
      grossPaise: r.refundPaise, commissionPaise: r.refundPaise - share, netPaise: -share,
      availableAt: at, at, ref: { kind: "consultation", id: r.sessionId, label: `Refund on chat ${r.sessionNumber}` }, note: `Customer refunded ${inr(r.refundPaise)}`, actor: r.actor,
    });
  },
};

/* ============================================================ *
 * Balance
 * ============================================================ */

async function balanceOf(astrologerId: string): Promise<EarningsBalance> {
  const { AstroLedgerModel, AstroPayoutModel } = await M();
  const now = nowIso();
  const [l] = await AstroLedgerModel.aggregate([
    { $match: { astrologerId } },
    {
      $group: {
        _id: null,
        available: { $sum: { $cond: [{ $lte: ["$availableAt", now] }, "$netPaise", 0] } },
        onHold: { $sum: { $cond: [{ $gt: ["$availableAt", now] }, "$netPaise", 0] } },
        lifetime: { $sum: { $cond: [{ $in: ["$type", EARNING_TYPES] }, "$netPaise", 0] } },
      },
    },
  ]);
  const p = await AstroPayoutModel.aggregate([
    { $match: { astrologerId } },
    { $group: { _id: "$status", sum: { $sum: "$amountPaise" } } },
  ]);
  const by = Object.fromEntries(p.map((x: { _id: string; sum: number }) => [x._id, x.sum]));
  const next = await AstroLedgerModel.findOne({ astrologerId, availableAt: { $gt: now }, netPaise: { $gt: 0 } }).sort({ availableAt: 1 }).select("availableAt").lean<Doc>();
  let nextPaise = 0;
  if (next) {
    const until = new Date(Date.parse(next.availableAt as string) + DAY).toISOString();
    const [s] = await AstroLedgerModel.aggregate([{ $match: { astrologerId, availableAt: { $gt: now, $lte: until } } }, { $group: { _id: null, sum: { $sum: "$netPaise" } } }]);
    nextPaise = s?.sum ?? 0;
  }
  return {
    availablePaise: l?.available ?? 0,
    onHoldPaise: l?.onHold ?? 0,
    inPayoutPaise: OPEN_PAYOUT.reduce((n, k) => n + (by[k] ?? 0), 0),
    lifetimePaise: l?.lifetime ?? 0,
    paidOutPaise: by.paid ?? 0,
    nextReleaseAt: (next?.availableAt as string) ?? null,
    nextReleasePaise: nextPaise,
  };
}

/* ============================================================ *
 * Payouts
 * ============================================================ */

async function getPayout(id: string): Promise<Payout | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const { AstroPayoutModel } = await M();
  return payoutOut(await AstroPayoutModel.findById(id).lean<Doc>());
}

/** Compare-and-set a payout's status; appends history. */
async function move(id: string, from: PayoutStatus[], to: PayoutStatus, by: string, set: Record<string, unknown> = {}, note?: string): Promise<Payout | null> {
  const { AstroPayoutModel } = await M();
  const at = nowIso();
  const done = OPEN_PAYOUT.includes(to) ? {} : { openKey: null };
  return payoutOut(await AstroPayoutModel.findOneAndUpdate(
    { _id: id, status: { $in: from } },
    { $set: { status: to, updatedAt: at, ...done, ...set }, $push: { history: { at, status: to, by, ...(note ? { note } : {}) } } },
    { new: true },
  ).lean<Doc>());
}

/** Money back to the balance (exactly once per payout). */
async function reverse(p: Payout, why: string, actor: string): Promise<void> {
  const at = nowIso();
  await record({
    key: `payout-reversal:${p.id}`, astrologerId: p.astrologerId, type: "payout_reversal",
    grossPaise: p.amountPaise, commissionPaise: 0, netPaise: p.amountPaise, availableAt: at, at,
    ref: { kind: "payout", id: p.id, label: `Payout ${p.payoutNumber} returned` }, note: why, actor,
  });
}

function destHash(d: { method: string; accountNumber?: string; ifsc?: string; upiId?: string }) {
  return crypto.createHash("sha256").update(`${d.method}|${d.accountNumber ?? ""}|${(d.ifsc ?? "").toUpperCase()}|${(d.upiId ?? "").toLowerCase()}`).digest("hex").slice(0, 32);
}

/** Apply a RazorpayX payout status to our payout. */
async function applyProvider(p: Payout, rz: { id: string; status: string; utr: string | null; failure_reason?: string | null; status_details?: { description?: string } | null }, by: string): Promise<Payout> {
  const set = { providerPayoutId: rz.id, providerStatus: rz.status };
  if (rz.status === "processed") {
    const done = await move(p.id, ["processing", "approved"], "paid", by, { ...set, utr: rz.utr ?? null, paidAt: nowIso() });
    if (done) {
      await notify(p.astrologerId, "Payout sent", `${inr(p.netPaise)} was sent to your account${rz.utr ? ` (UTR ${rz.utr})` : ""}.`);
      await auditService.record({ action: "payment", entity: "payout", entityId: p.id, entityLabel: p.payoutNumber, summary: `Payout ${p.payoutNumber} paid by RazorpayX · ${inr(p.netPaise)}`, actor: by }).catch(() => undefined);
    }
    return done ?? (await getPayout(p.id)) ?? p;
  }
  if (["failed", "reversed", "rejected", "cancelled"].includes(rz.status)) {
    const why = rz.failure_reason || rz.status_details?.description || `RazorpayX: ${rz.status}`;
    const done = await move(p.id, ["processing", "approved", "paid"], "failed", by, { ...set, failureReason: why }, why);
    if (done) {
      await reverse(done, why, by);
      await notify(p.astrologerId, "Payout failed", `Your payout ${p.payoutNumber} could not be sent: ${why}. The money is back in your balance.`);
    }
    return done ?? (await getPayout(p.id)) ?? p;
  }
  const { AstroPayoutModel } = await M();
  await AstroPayoutModel.updateOne({ _id: p.id }, { $set: { ...set, updatedAt: nowIso() } });
  return (await getPayout(p.id)) ?? p;
}

export const earningsService = {
  balance: balanceOf,

  async entries(astrologerId: string, f: { cursor?: string; limit?: number; type?: LedgerType } = {}): Promise<{ items: LedgerEntry[]; nextCursor: string | null }> {
    const { AstroLedgerModel } = await M();
    const limit = Math.min(Math.max(f.limit ?? 30, 1), 100);
    const q: Record<string, unknown> = { astrologerId, ...(f.type ? { type: f.type } : {}), ...(f.cursor ? { at: { $lt: f.cursor } } : {}) };
    const rows = await AstroLedgerModel.find(q).sort({ at: -1 }).limit(limit + 1).lean<Doc[]>();
    const items = rows.slice(0, limit).map(entryOut);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].at : null };
  },

  /** Rules shown to the astrologer next to the balance. */
  async rules() {
    const st = await astroSettingsService.get();
    return { holdDays: st.holdDays, minPayoutPaise: st.payoutMinAmount * 100, cycle: st.payoutCycle, cycleWeekday: st.payouts.cycleWeekday, autoCreate: st.payouts.autoCreate, maxPerRequestPaise: st.payouts.maxPerRequest * 100, tds: st.tds, requireVerifiedAccount: st.payouts.requireVerifiedAccount, commissionPct: st.commissionPct };
  },

  async payouts(astrologerId: string): Promise<Payout[]> {
    const { AstroPayoutModel } = await M();
    return ((await AstroPayoutModel.find({ astrologerId }).sort({ createdAt: -1 }).limit(100).lean<Doc[]>()).map(payoutOut).filter(Boolean)) as Payout[];
  },

  /** Withdraw from the available balance. Idempotent on `requestId`. Default = everything withdrawable (whole rupees). */
  async request(astrologerId: string, input: { amountPaise?: number; requestId: string }, by: "astrologer" | "auto" | "admin" = "astrologer"): Promise<Result<Payout>> {
    const { AstroPayoutModel } = await M();
    const again = payoutOut(await AstroPayoutModel.findOne({ requestId: input.requestId }).lean<Doc>());
    if (again) return again.astrologerId === astrologerId ? ok(again) : fail(AppErrors.conflict("This request was already used."));

    const st = await astroSettingsService.get();
    const a = await astrologerService.getInternal(astrologerId);
    if (!a || a.status !== "approved") return fail(AppErrors.forbidden("Payouts are available for approved partners only."));
    if (!a.payout) return fail(AppErrors.validation("Add your bank or UPI details in KYC & payout first.", { reason: "NO_ACCOUNT" }));
    if (st.payouts.requireVerifiedAccount && !a.payout.verified) return fail(AppErrors.validation("Your payout account is being verified. You can withdraw once it is verified.", { reason: "ACCOUNT_NOT_VERIFIED" }));
    const open = await AstroPayoutModel.findOne({ openKey: astrologerId }).select("payoutNumber").lean<Doc>();
    if (open) return fail(AppErrors.conflict(`Payout ${open.payoutNumber} is still in progress. You can request the next one after it is done.`, { reason: "OPEN_PAYOUT" }));

    const bal = await balanceOf(astrologerId);
    const amount = input.amountPaise ?? Math.floor(bal.availablePaise / 100) * 100;
    const min = st.payoutMinAmount * 100;
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail(AppErrors.validation("Nothing to withdraw yet.", { reason: "NOTHING" }));
    if (amount < min) return fail(AppErrors.validation(`The minimum payout is ${inr(min)}.`, { reason: "MIN", minPaise: min }));
    if (amount > bal.availablePaise) return fail(AppErrors.validation(`You can withdraw up to ${inr(Math.max(0, bal.availablePaise))} now.`, { reason: "OVER", availablePaise: bal.availablePaise }));
    if (st.payouts.maxPerRequest > 0 && amount > st.payouts.maxPerRequest * 100) return fail(AppErrors.validation(`The most per payout is ${inr(st.payouts.maxPerRequest * 100)}.`, { reason: "MAX" }));

    const dest = await astrologerService.payoutDestination(astrologerId);
    const pan = dest.ok ? dest.value.pan ?? null : null;
    const tdsRatePct = st.tds.enabled ? (pan ? st.tds.ratePct : st.tds.noPanRatePct ?? st.tds.ratePct) : 0;
    const tdsPaise = Math.round((amount * tdsRatePct) / 100);
    const destination: PayoutDestination = { method: a.payout.method, accountHolder: a.payout.accountHolder, accountNumberMasked: a.payout.accountNumberMasked, ifsc: a.payout.ifsc, bankName: a.payout.bankName, upiId: a.payout.upiId };
    const at = nowIso();
    let created: Doc;
    try {
      const d = await AstroPayoutModel.create({
        payoutNumber: `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        requestId: input.requestId, astrologerId, astrologer: { name: a.displayName, email: a.email },
        amountPaise: amount, tdsRatePct, tdsPaise, netPaise: amount - tdsPaise, pan: pan ? `${pan.slice(0, 2)}XXXXX${pan.slice(-3)}` : null,
        destination, status: "requested", openKey: astrologerId, requestedBy: by, provider: st.payouts.provider,
        createdAt: at, updatedAt: at, history: [{ at, status: "requested", by: by === "astrologer" ? a.displayName : by === "auto" ? "Weekly payout run" : "Admin" }],
      });
      created = d.toObject() as Doc;
    } catch (e) {
      if (isDup(e, "openKey")) return fail(AppErrors.conflict("A payout is already in progress.", { reason: "OPEN_PAYOUT" }));
      if (isDup(e, "requestId")) { const x = payoutOut(await AstroPayoutModel.findOne({ requestId: input.requestId }).lean<Doc>()); if (x) return ok(x); }
      throw e;
    }
    const p = payoutOut(created)!;
    try {
      await record({
        key: `payout:${p.id}`, astrologerId, type: "payout", grossPaise: amount, commissionPaise: 0, netPaise: -amount, availableAt: at, at,
        ref: { kind: "payout", id: p.id, label: `Payout ${p.payoutNumber}` }, note: tdsPaise ? `TDS ${tdsRatePct}%: ${inr(tdsPaise)} · to bank ${inr(amount - tdsPaise)}` : "", actor: by,
      });
    } catch (e) {
      // Never leave a payout without its debit.
      await AstroPayoutModel.deleteOne({ _id: p.id });
      throw e;
    }
    // A late debit raced us below zero? Undo the payout.
    const after = await balanceOf(astrologerId);
    if (after.availablePaise < 0) {
      const back = await move(p.id, ["requested"], "cancelled", "System", {}, "Balance changed while requesting");
      if (back) await reverse(back, "Balance changed while requesting", "System");
      return fail(AppErrors.conflict("Your balance just changed. Please try again."));
    }
    await auditService.record({ action: "create", entity: "payout", entityId: p.id, entityLabel: p.payoutNumber, summary: `Payout ${p.payoutNumber} requested by ${by} for ${a.displayName} · ${inr(amount)}${tdsPaise ? ` (TDS ${inr(tdsPaise)})` : ""}`, actor: by === "astrologer" ? a.displayName : by }).catch(() => undefined);
    return ok(p);
  },

  async cancel(astrologerId: string, id: string): Promise<Result<Payout>> {
    const p = await getPayout(id);
    if (!p || p.astrologerId !== astrologerId) return fail(AppErrors.notFound("Payout not found"));
    if (p.status !== "requested") return fail(AppErrors.validation("Only a payout that is still waiting for approval can be cancelled."));
    const done = await move(id, ["requested"], "cancelled", p.astrologer.name, {}, "Cancelled by the astrologer");
    if (!done) return fail(AppErrors.conflict("This payout was just updated. Reload and try again."));
    await reverse(done, "Cancelled by the astrologer", p.astrologer.name);
    return ok(done);
  },

  /* ---------- admin ---------- */

  async adminList(f: { status?: string; astrologerId?: string }): Promise<Payout[]> {
    const { AstroPayoutModel } = await M();
    const q: Record<string, unknown> = {};
    if (f.status === "open") q.status = { $in: OPEN_PAYOUT };
    else if (f.status && f.status !== "all") q.status = f.status;
    if (f.astrologerId) q.astrologerId = f.astrologerId;
    return ((await AstroPayoutModel.find(q).sort({ createdAt: -1 }).limit(300).lean<Doc[]>()).map(payoutOut).filter(Boolean)) as Payout[];
  },

  async adminGet(id: string): Promise<Result<{ payout: Payout; destination: Awaited<ReturnType<typeof astrologerService.payoutDestination>> extends Result<infer T> ? T | null : null; balance: EarningsBalance }>> {
    const p = await getPayout(id);
    if (!p) return fail(AppErrors.notFound("Payout not found"));
    const d = await astrologerService.payoutDestination(p.astrologerId);
    return ok({ payout: p, destination: d.ok ? d.value : null, balance: await balanceOf(p.astrologerId) });
  },

  /** approve | reject | mark_paid | mark_failed | send (RazorpayX) | refresh (RazorpayX) */
  async adminAction(id: string, action: string, body: { utr?: string; reason?: string }, adminName: string): Promise<Result<Payout>> {
    const p = await getPayout(id);
    if (!p) return fail(AppErrors.notFound("Payout not found"));
    const audit = (summary: string) => auditService.record({ action: "status", entity: "payout", entityId: p.id, entityLabel: p.payoutNumber, summary, actor: adminName }).catch(() => undefined);
    switch (action) {
      case "approve": {
        const done = await move(id, ["requested"], "approved", adminName);
        if (!done) return fail(AppErrors.validation("Only a requested payout can be approved."));
        await audit(`Approved payout ${p.payoutNumber} · ${inr(p.netPaise)}`);
        return ok(done);
      }
      case "reject": {
        const why = (body.reason ?? "").trim();
        if (why.length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
        const done = await move(id, ["requested", "approved"], "rejected", adminName, { failureReason: why }, why);
        if (!done) return fail(AppErrors.validation("This payout cannot be rejected now."));
        await reverse(done, `Rejected: ${why}`, adminName);
        await notify(p.astrologerId, "Payout not approved", `Payout ${p.payoutNumber} was not approved: ${why}. The money is back in your balance.`);
        await audit(`Rejected payout ${p.payoutNumber}: ${why}`);
        return ok(done);
      }
      case "mark_paid": {
        const utr = (body.utr ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9]{6,30}$/.test(utr)) return fail(AppErrors.validation("Enter the bank reference (UTR), 6 to 30 letters or numbers."));
        const done = await move(id, ["requested", "approved", "processing"], "paid", adminName, { utr, paidAt: nowIso() }, `UTR ${utr}`);
        if (!done) return fail(AppErrors.validation("This payout cannot be marked paid now."));
        await notify(p.astrologerId, "Payout sent", `${inr(p.netPaise)} was sent to your account (UTR ${utr}).`);
        await audit(`Marked payout ${p.payoutNumber} paid · UTR ${utr} · ${inr(p.netPaise)}`);
        return ok(done);
      }
      case "mark_failed": {
        const why = (body.reason ?? "").trim();
        if (why.length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
        const done = await move(id, ["approved", "processing", "paid"], "failed", adminName, { failureReason: why }, why);
        if (!done) return fail(AppErrors.validation("This payout cannot be marked failed now."));
        await reverse(done, `Failed: ${why}`, adminName);
        await notify(p.astrologerId, "Payout failed", `Payout ${p.payoutNumber} could not be completed: ${why}. The money is back in your balance.`);
        await audit(`Payout ${p.payoutNumber} failed: ${why}`);
        return ok(done);
      }
      case "send": {
        const st = await astroSettingsService.get();
        const rz = await import("@/core/razorpayx");
        if (st.payouts.provider !== "razorpayx") return fail(AppErrors.validation("Automatic payouts are off. Switch the payout provider to RazorpayX in program settings."));
        if (!rz.razorpayxConfigured()) return fail(AppErrors.validation("RazorpayX is not set up on the server (keys and account number)."));
        if (p.status !== "approved") return fail(AppErrors.validation("Approve the payout first."));
        const dest = await astrologerService.payoutDestination(p.astrologerId);
        if (!dest.ok) return fail(dest.error);
        const d = dest.value;
        if (d.method === "bank" && (!d.accountNumber || !d.ifsc)) return fail(AppErrors.validation("The bank details are incomplete."));
        if (d.method === "upi" && !d.upiId) return fail(AppErrors.validation("The UPI id is missing."));
        // Claim the payout before calling out, so a double click sends once.
        const claimed = await move(id, ["approved"], "processing", adminName, { provider: "razorpayx" }, "Sent to RazorpayX");
        if (!claimed) return fail(AppErrors.conflict("This payout was just updated. Reload and try again."));
        try {
          const { AstroRzpxAccountModel } = await M();
          const h = destHash(d);
          let acc = await AstroRzpxAccountModel.findOne({ astrologerId: p.astrologerId, destHash: h }).lean<Doc>();
          if (!acc) {
            const contactId = await rz.createContact({ name: d.accountHolder || p.astrologer.name, email: p.astrologer.email, referenceId: p.astrologerId });
            const fundAccountId = await rz.createFundAccount(contactId, d.method === "bank" ? { method: "bank", name: d.accountHolder || p.astrologer.name, ifsc: d.ifsc!, accountNumber: d.accountNumber! } : { method: "upi", upiId: d.upiId! });
            await AstroRzpxAccountModel.updateOne({ astrologerId: p.astrologerId, destHash: h }, { $setOnInsert: { contactId, fundAccountId, at: nowIso() } }, { upsert: true });
            acc = await AstroRzpxAccountModel.findOne({ astrologerId: p.astrologerId, destHash: h }).lean<Doc>();
          }
          const res = await rz.createPayout({ fundAccountId: acc!.fundAccountId as string, amountPaise: p.netPaise, mode: d.method === "upi" ? "UPI" : "IMPS", referenceId: p.payoutNumber, narration: `Astrounkle ${p.payoutNumber}`, idempotencyKey: p.id });
          await audit(`Sent payout ${p.payoutNumber} via RazorpayX · ${inr(p.netPaise)} · ${res.status}`);
          return ok(await applyProvider(claimed, res, adminName));
        } catch (e) {
          // The call failed before RazorpayX accepted it: back to approved so it can be retried.
          const msg = e instanceof Error ? e.message : "RazorpayX error";
          await move(id, ["processing"], "approved", adminName, { providerStatus: "error", failureReason: msg }, `Send failed: ${msg}`);
          return fail(AppErrors.validation(`RazorpayX: ${msg}`));
        }
      }
      case "refresh": {
        if (!p.providerPayoutId) return fail(AppErrors.validation("This payout was not sent through RazorpayX."));
        const rz = await import("@/core/razorpayx");
        if (!rz.razorpayxConfigured()) return fail(AppErrors.validation("RazorpayX is not set up on the server."));
        return ok(await applyProvider(p, await rz.getPayout(p.providerPayoutId), adminName));
      }
      default:
        return fail(AppErrors.notFound("Unknown action"));
    }
  },

  /** RazorpayX webhook: payout.processed / failed / reversed / rejected / updated. */
  async onRazorpayxEvent(entity: { id: string; status: string; utr: string | null; reference_id?: string; failure_reason?: string | null; status_details?: { description?: string } | null }): Promise<boolean> {
    const { AstroPayoutModel } = await M();
    const d = await AstroPayoutModel.findOne(entity.id ? { providerPayoutId: entity.id } : { payoutNumber: entity.reference_id }).lean<Doc>();
    const p = payoutOut(d) ?? (entity.reference_id ? payoutOut(await AstroPayoutModel.findOne({ payoutNumber: entity.reference_id }).lean<Doc>()) : null);
    if (!p) return false;
    await applyProvider(p, entity, "RazorpayX");
    return true;
  },

  /** Admin correction (+ or −), with a reason. Idempotent on requestId. */
  async adjust(astrologerId: string, amountPaise: number, reason: string, requestId: string, adminName: string): Promise<Result<EarningsBalance>> {
    if (!Number.isSafeInteger(amountPaise) || amountPaise === 0 || Math.abs(amountPaise) > 10_000_000) return fail(AppErrors.validation("Enter an amount between -₹1,00,000 and ₹1,00,000 (not 0)."));
    if (reason.trim().length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
    const a = await astrologerService.getInternal(astrologerId);
    if (!a) return fail(AppErrors.notFound("Astrologer not found"));
    const at = nowIso();
    const fresh = await record({
      key: `adjust:${requestId}`, astrologerId, type: "adjustment", grossPaise: 0, commissionPaise: 0, netPaise: amountPaise, availableAt: at, at,
      ref: { kind: "admin", id: requestId, label: amountPaise > 0 ? "Added by AstroUnkle" : "Deducted by AstroUnkle" }, note: reason.trim().slice(0, 300), actor: adminName,
    });
    if (fresh) {
      await auditService.record({ action: "update", entity: "payout", entityId: astrologerId, entityLabel: a.displayName, summary: `Earnings adjustment ${amountPaise > 0 ? "+" : "−"}${inr(Math.abs(amountPaise))} for ${a.displayName}: ${reason.trim()}`, actor: adminName }).catch(() => undefined);
      await notify(astrologerId, amountPaise > 0 ? "Earnings added" : "Earnings adjusted", `${amountPaise > 0 ? "+" : "−"}${inr(Math.abs(amountPaise))}: ${reason.trim()}`);
    }
    return ok(await balanceOf(astrologerId));
  },

  /** Every astrologer with any money in the ledger, with their balance (admin overview). */
  async adminBalances(): Promise<{ astrologerId: string; name: string; balance: EarningsBalance }[]> {
    const { AstroLedgerModel } = await M();
    const ids = (await AstroLedgerModel.distinct("astrologerId")) as string[];
    const out: { astrologerId: string; name: string; balance: EarningsBalance }[] = [];
    for (const id of ids.slice(0, 500)) {
      const a = await astrologerService.getInternal(id).catch(() => null);
      out.push({ astrologerId: id, name: a?.displayName ?? "Removed partner", balance: await balanceOf(id) });
    }
    return out.sort((x, y) => y.balance.availablePaise - x.balance.availablePaise);
  },

  /**
   * Bring the ledger in line with what already happened: paid chats, customer
   * refunds and live gifts that have no ledger row yet. Safe to run any time
   * (unique keys); the sweep runs it too, so a missed hook heals by itself.
   */
  async reconcile(): Promise<{ consultations: number; refunds: number; gifts: number; tips: number; superChats: number }> {
    const { AstroLedgerModel } = await M();
    const res = { consultations: 0, refunds: 0, gifts: 0, tips: 0, superChats: 0 };
    const { ConsultSessionModel } = await import("@/modules/consultations/consult.model");
    const sessions = await ConsultSessionModel.find({ status: "ended", earningPaise: { $gt: 0 } }).select("_id sessionNumber astrologerId chargedPaise earningPaise endedAt customer refundedPaise commissionPct").lean<Doc[]>();
    const have = new Set((await AstroLedgerModel.find({ type: { $in: ["consultation", "refund"] } }).select("key").lean<Doc[]>()).map((d) => d.key as string));
    const refundSessions = new Set([...have].filter((k) => k.startsWith("refund:")).map((k) => k.split(":")[1]));
    for (const s of sessions) {
      const id = String(s._id);
      if (!have.has(`consult:${id}`)) {
        await earningsLedger.consultation({ id, sessionNumber: s.sessionNumber as string, astrologerId: s.astrologerId as string, chargedPaise: s.chargedPaise as number, earningPaise: s.earningPaise as number, endedAt: (s.endedAt as string) ?? null, customerName: ((s.customer as { name?: string }) ?? {}).name ?? "Customer" });
        res.consultations++;
      }
      if ((s.refundedPaise as number) > 0 && !refundSessions.has(id)) {
        await earningsLedger.refund({ sessionId: id, sessionNumber: s.sessionNumber as string, requestId: "backfill", astrologerId: s.astrologerId as string, refundPaise: s.refundedPaise as number, commissionPct: s.commissionPct as number, actor: "System" });
        res.refunds++;
      }
    }
    // Tips after chats.
    const tipped = await ConsultSessionModel.find({ "tips.0": { $exists: true } }).select("_id sessionNumber astrologerId customer tips").lean<Doc[]>();
    if (tipped.length) {
      const haveTip = new Set((await AstroLedgerModel.find({ type: "tip" }).select("key").lean<Doc[]>()).map((d) => d.key as string));
      for (const s of tipped) {
        for (const t of (s.tips as { requestId: string; amountPaise: number; at: string }[]) ?? []) {
          if (haveTip.has(`tip:${String(s._id)}:${t.requestId}`)) continue;
          await earningsLedger.tip({ sessionId: String(s._id), sessionNumber: s.sessionNumber as string, requestId: t.requestId, astrologerId: s.astrologerId as string, amountPaise: t.amountPaise, from: ((s.customer as { name?: string }) ?? {}).name ?? "Customer", at: t.at });
          res.tips++;
        }
      }
    }
    const { LiveSessionModel, LiveEventModel, LiveQueueModel } = await import("@/modules/live/live.model");
    // Answered Super Chats.
    const earnedSc = await LiveQueueModel.find({ paidState: "earned", paidPaise: { $gt: 0 } }).select("_id liveId name paidPaise updatedAt").lean<Doc[]>();
    if (earnedSc.length) {
      const haveSc = new Set((await AstroLedgerModel.find({ type: "super_chat" }).select("key").lean<Doc[]>()).map((d) => d.key as string));
      const scLives = new Map((await LiveSessionModel.find({ _id: { $in: [...new Set(earnedSc.map((q) => q.liveId as string))] } }).select("_id astrologerId liveNumber commissionPct").lean<Doc[]>()).map((l) => [String(l._id), l]));
      for (const q of earnedSc) {
        const l = scLives.get(q.liveId as string);
        if (!l || haveSc.has(`superchat:${String(q._id)}`)) continue;
        const price = q.paidPaise as number;
        await earningsLedger.superChat({ queueId: String(q._id), liveId: q.liveId as string, liveNumber: l.liveNumber as string, astrologerId: l.astrologerId as string, pricePaise: price, earningPaise: Math.floor((price * (100 - (l.commissionPct as number))) / 100), from: (q.name as string) ?? "Viewer", at: q.updatedAt as string });
        res.superChats++;
      }
    }
    const gifts = await LiveEventModel.find({ kind: "gift", clientId: { $type: "string" } }).select("liveId clientId gift name at").lean<Doc[]>();
    if (gifts.length) {
      const haveGift = new Set((await AstroLedgerModel.find({ type: "gift" }).select("key").lean<Doc[]>()).map((d) => d.key as string));
      const lives = new Map((await LiveSessionModel.find({ _id: { $in: [...new Set(gifts.map((g) => g.liveId as string))] } }).select("_id astrologerId liveNumber commissionPct").lean<Doc[]>()).map((l) => [String(l._id), l]));
      for (const g of gifts) {
        const key = `gift:${g.liveId}:${g.clientId}`;
        const l = lives.get(g.liveId as string);
        if (haveGift.has(key) || !l) continue;
        const price = Math.round(((g.gift as { price?: number }) ?? {}).price ?? 0) * 100;
        if (price <= 0) continue;
        await earningsLedger.gift({ liveId: g.liveId as string, liveNumber: l.liveNumber as string, clientId: g.clientId as string, astrologerId: l.astrologerId as string, pricePaise: price, earningPaise: Math.floor((price * (100 - (l.commissionPct as number))) / 100), giftName: ((g.gift as { name?: string }) ?? {}).name ?? "Gift", from: (g.name as string) ?? "Viewer", at: g.at as string });
        res.gifts++;
      }
    }
    return res;
  },

  /**
   * Weekly payout run (when "auto create" is on): on the cycle weekday (IST),
   * once per day, request a payout for everyone whose withdrawable balance is
   * at or above the minimum. `force` = admin "Run now" (any day, still once a day).
   */
  async runWeekly(force = false): Promise<{ ran: boolean; created: number; skipped: number; date: string }> {
    const st = await astroSettingsService.get();
    const ist = new Date(Date.now() + 5.5 * 3600_000);
    const date = ist.toISOString().slice(0, 10);
    if (!force && (!st.payouts.autoCreate || ist.getUTCDay() !== st.payouts.cycleWeekday)) return { ran: false, created: 0, skipped: 0, date };
    const { AstroJobModel, AstroLedgerModel } = await M();
    try {
      await AstroJobModel.create({ key: `payouts:weekly:${date}`, at: nowIso() });
    } catch (e) {
      if (isDup(e, "key")) return { ran: false, created: 0, skipped: 0, date };
      throw e;
    }
    const now = nowIso();
    const rows = await AstroLedgerModel.aggregate([
      { $match: { availableAt: { $lte: now } } },
      { $group: { _id: "$astrologerId", available: { $sum: "$netPaise" } } },
      { $match: { available: { $gte: st.payoutMinAmount * 100 } } },
    ]);
    let created = 0, skipped = 0;
    for (const r of rows as { _id: string }[]) {
      const res = await this.request(r._id, { requestId: `auto:${date}:${r._id}` }, "auto").catch(() => null);
      if (res?.ok) created++; else skipped++;
    }
    const { AstroJobModel: J } = await M();
    await J.updateOne({ key: `payouts:weekly:${date}` }, { $set: { result: { created, skipped } } });
    return { ran: true, created, skipped, date };
  },

  /** CSV of payouts for a bank bulk upload (full account numbers: admin with payouts:edit only). */
  async exportCsv(status: string): Promise<string> {
    const list = await this.adminList({ status });
    const head = ["Payout", "Astrologer", "Method", "Account holder", "Account number", "IFSC", "UPI", "Amount", "TDS", "To pay", "Status", "Requested"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(",")];
    for (const p of list) {
      const d = await astrologerService.payoutDestination(p.astrologerId);
      const dv = d.ok ? d.value : null;
      lines.push([p.payoutNumber, p.astrologer.name, p.destination.method, dv?.accountHolder ?? "", dv?.accountNumber ?? "", dv?.ifsc ?? "", dv?.upiId ?? "", (p.amountPaise / 100).toFixed(2), (p.tdsPaise / 100).toFixed(2), (p.netPaise / 100).toFixed(2), p.status, p.createdAt].map(esc).join(","));
    }
    return lines.join("\n");
  },

  /** Tax view: TDS deducted on paid payouts, by financial year (Apr-Mar). */
  async tdsSummary(astrologerId: string): Promise<{ fy: string; payouts: number; grossPaise: number; tdsPaise: number }[]> {
    const { AstroPayoutModel } = await M();
    const rows = await AstroPayoutModel.find({ astrologerId, status: "paid" }).select("amountPaise tdsPaise paidAt").lean<Doc[]>();
    const by = new Map<string, { fy: string; payouts: number; grossPaise: number; tdsPaise: number }>();
    for (const r of rows) {
      const d = new Date(Date.parse((r.paidAt as string) ?? nowIso()) + 5.5 * 3600_000);
      const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
      const fy = `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`;
      const cur = by.get(fy) ?? { fy, payouts: 0, grossPaise: 0, tdsPaise: 0 };
      cur.payouts++; cur.grossPaise += r.amountPaise as number; cur.tdsPaise += (r.tdsPaise as number) ?? 0;
      by.set(fy, cur);
    }
    return [...by.values()].sort((a, b) => b.fy.localeCompare(a.fy));
  },
};

let lastRun = 0;
let running: Promise<unknown> | null = null;
/** Cheap background job: reconcile the ledger and the weekly payout run, at most every 10 minutes per server. */
export function maybeRunEarningsJobs(everyMs = 10 * 60_000): void {
  if (running || Date.now() - lastRun < everyMs) return;
  lastRun = Date.now();
  running = (async () => {
    await earningsService.reconcile().catch(() => undefined);
    await earningsService.runWeekly(false).catch(() => undefined);
  })().finally(() => { running = null; });
}
