import "server-only";

/**
 * Refer a friend.
 *
 * Flow
 *   1. Every customer has one personal code (AU + 6 letters/digits, no 0/O/1/I).
 *   2. A NEW customer enters a friend's code (within `applyWithinDays` of
 *      signing up, before their first paid recharge). Nothing is credited yet.
 *   3. When that friend makes a paid recharge of at least `minRecharge`
 *      within `qualifyWithinDays`, both get a bonus in the promo bucket
 *      (spendable on consultations, never paid out in cash).
 *   4. The referrer earns for at most `monthlyCap` friends per calendar month
 *      (IST). Over the cap the friend still gets their bonus.
 *
 * Misuse checks
 *   • one referral per customer, ever (unique refereeId); no self or two-way referral
 *   • only new accounts with no paid recharge yet; blocked / deleted accounts refused
 *   • several sign-ups for one referrer from the same network are held for an
 *     admin check instead of being paid
 *   • bonus credits are idempotent (`ref:<id>:referee`, `ref:<id>:referrer`)
 *     and a sweep finishes any reward that was interrupted
 *
 * All amounts are fixed on the referral row when the code is entered.
 */

import { randomInt } from "node:crypto";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { astroSettingsService } from "@/modules/astro-settings";
import { auditService } from "@/modules/audit";
import { BRAND } from "@/lib/brand";

type Doc = Record<string, unknown> & { _id: unknown };

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  const m = await import("./referral.model");
  const { CustomerModel } = await import("@/modules/customers/customer.model");
  return { ...m, CustomerModel };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nowIso = () => new Date().toISOString();
const DAY = 86_400_000;
/** Same network sign-ups for one referrer (30 days) before the next ones are held for review. */
const SAME_IP_LIMIT = 3;

export const normCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const istMonth = (iso = nowIso()) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 7);
const firstName = (n: unknown) => (String(n || "").trim().split(/\s+/)[0] || "Friend").slice(0, 30);
const isDup = (e: unknown) => (e as { code?: number })?.code === 11000;

export type ReferralStatus = "pending" | "qualified" | "review" | "rewarded" | "expired" | "rejected";

export interface ReferralView {
  enabled: boolean;
  code: string;
  shareText: string;
  rewards: { referrerRupees: number; refereeRupees: number; minRechargeRupees: number; monthlyCap: number; qualifyWithinDays: number };
  stats: { joined: number; waiting: number; rewarded: number; earnedPaise: number; thisMonth: number; capLeft: number };
  /** Newest friends who used my code (first name only). */
  friends: { name: string; status: ReferralStatus; at: string; earnedPaise: number }[];
  /** The code I entered, if any. */
  applied: { referrerName: string; status: ReferralStatus; rewardPaise: number; minRechargePaise: number; expiresAt: string } | null;
  /** Can I still enter a friend's code? (null = yes) */
  cannotApply: string | null;
  applyUntil: string | null;
}

async function customer(id: string): Promise<Doc | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const { CustomerModel } = await M();
  return CustomerModel.findOne({ _id: id, isDeleted: { $ne: true } }).select("name status createdAt").lean<Doc>();
}

async function paidRecharges(customerId: string): Promise<number> {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const conn = await connectMongoose();
  return conn.connection.collection("wallet_recharges").countDocuments({ customerId, status: "paid" });
}

async function codeOf(customerId: string): Promise<string> {
  const { ReferralCodeModel } = await M();
  const have = await ReferralCodeModel.findOne({ customerId }).lean<Doc>();
  if (have) return have.code as string;
  for (let i = 0; i < 8; i++) {
    const code = `AU${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
    try {
      await ReferralCodeModel.create({ customerId, code, createdAt: nowIso() });
      return code;
    } catch (e) {
      if (!isDup(e)) throw e;
      const again = await ReferralCodeModel.findOne({ customerId }).lean<Doc>();
      if (again) return again.code as string; // a parallel call made it
    }
  }
  throw new Error("could not make a referral code");
}

/** Why this customer cannot enter a code now (null = they can). */
async function applyBlock(c: Doc, customerId: string): Promise<{ reason: string; code: string } | null> {
  const st = (await astroSettingsService.get()).referral;
  const { ReferralModel } = await M();
  if (!st.enabled) return { reason: "Referral codes are not available right now.", code: "REFERRAL_OFF" };
  if (await ReferralModel.exists({ refereeId: customerId })) return { reason: "You have already used a friend's code.", code: "ALREADY_APPLIED" };
  if (c.status === "blocked") return { reason: "This account cannot use referral codes.", code: "BLOCKED" };
  const created = c.createdAt instanceof Date ? c.createdAt.getTime() : Date.parse(String(c.createdAt ?? ""));
  if (Number.isFinite(created) && created + st.applyWithinDays * DAY < Date.now()) return { reason: `A friend's code can be used only in the first ${st.applyWithinDays} days after you join.`, code: "TOO_LATE" };
  if ((await paidRecharges(customerId)) > 0) return { reason: "Friend's codes are for new customers, before their first recharge.", code: "NOT_NEW" };
  return null;
}

/** Credit both bonuses for a qualified referral, then mark it rewarded. Safe to run again. */
async function reward(r: Doc): Promise<void> {
  const { walletService } = await import("@/modules/wallets");
  const { ReferralModel } = await M();
  const id = String(r._id);
  const ref = `referral:${id}`;
  if ((r.refereeRewardPaise as number) > 0) {
    await walletService.creditReferral(r.refereeId as string, `ref:${id}:referee`, r.refereeRewardPaise as number, ref, `Welcome bonus: you joined with ${r.referrerName || "a friend"}'s code`);
  }
  if (!r.referrerCapped && (r.referrerRewardPaise as number) > 0) {
    await walletService.creditReferral(r.referrerId as string, `ref:${id}:referrer`, r.referrerRewardPaise as number, ref, `Referral bonus: ${r.refereeName || "your friend"} joined with your code`);
  }
  await ReferralModel.updateOne({ _id: r._id, status: "qualified" }, { $set: { status: "rewarded", rewardedAt: nowIso() } });
}

function shareText(code: string, refereeRupees: number, site: string): string {
  return refereeRupees > 0
    ? `Join me on AstroUnkle to talk to verified astrologers. Use my code ${code} when you sign up and get ₹${refereeRupees} bonus after your first recharge. ${site}`
    : `Join me on AstroUnkle to talk to verified astrologers. Use my code ${code} when you sign up. ${site}`;
}

export const referralService = {
  /** Refer screen: my code, rules, friends, and the code I used. */
  async mine(customerId: string): Promise<Result<ReferralView>> {
    const c = await customer(customerId);
    if (!c) return fail(AppErrors.notFound("Account not found"));
    const st = (await astroSettingsService.get()).referral;
    const { ReferralModel } = await M();
    const code = await codeOf(customerId);
    const month = istMonth();
    const [rows, mineApplied, thisMonth, block] = await Promise.all([
      ReferralModel.find({ referrerId: customerId }).sort({ appliedAt: -1 }).limit(500).lean<Doc[]>(),
      ReferralModel.findOne({ refereeId: customerId }).lean<Doc>(),
      ReferralModel.countDocuments({ referrerId: customerId, rewardMonth: month, referrerCapped: false, status: { $in: ["qualified", "rewarded"] } }),
      applyBlock(c, customerId),
    ]);
    const earnedOf = (r: Doc) => (r.status === "rewarded" && !r.referrerCapped ? (r.referrerRewardPaise as number) : 0);
    const created = c.createdAt instanceof Date ? c.createdAt.getTime() : Date.parse(String(c.createdAt ?? ""));
    return ok({
      enabled: st.enabled,
      code,
      shareText: shareText(code, st.refereeReward, `https://${BRAND.domain}`),
      rewards: { referrerRupees: st.referrerReward, refereeRupees: st.refereeReward, minRechargeRupees: st.minRecharge, monthlyCap: st.monthlyCap, qualifyWithinDays: st.qualifyWithinDays },
      stats: {
        joined: rows.length,
        waiting: rows.filter((r) => r.status === "pending" || r.status === "qualified" || r.status === "review").length,
        rewarded: rows.filter((r) => r.status === "rewarded").length,
        earnedPaise: rows.reduce((a, r) => a + earnedOf(r), 0),
        thisMonth,
        capLeft: Math.max(0, st.monthlyCap - thisMonth),
      },
      friends: rows.slice(0, 30).map((r) => ({ name: (r.refereeName as string) || "Friend", status: r.status as ReferralStatus, at: r.appliedAt as string, earnedPaise: earnedOf(r) })),
      applied: mineApplied ? {
        referrerName: (mineApplied.referrerName as string) || "Friend", status: mineApplied.status as ReferralStatus,
        rewardPaise: mineApplied.refereeRewardPaise as number, minRechargePaise: mineApplied.minRechargePaise as number, expiresAt: mineApplied.expiresAt as string,
      } : null,
      cannotApply: block?.reason ?? null,
      applyUntil: !block && Number.isFinite(created) ? new Date(created + st.applyWithinDays * DAY).toISOString() : null,
    });
  },

  /** A new customer enters a friend's code. Nothing is paid until their qualifying recharge. */
  async apply(customerId: string, rawCode: string, ctx: { ip: string }): Promise<Result<ReferralView>> {
    const code = normCode(rawCode);
    if (!/^AU[A-Z0-9]{6}$/.test(code)) return fail(AppErrors.validation("Enter a code like AUK7M2Q9", { reason: "BAD_CODE" }));
    const c = await customer(customerId);
    if (!c) return fail(AppErrors.notFound("Account not found"));
    const block = await applyBlock(c, customerId);
    if (block) return fail(AppErrors.validation(block.reason, { reason: block.code }));
    const { ReferralCodeModel, ReferralModel } = await M();
    const owner = await ReferralCodeModel.findOne({ code }).lean<Doc>();
    if (!owner) return fail(AppErrors.validation("This code is not valid. Check it with your friend.", { reason: "BAD_CODE" }));
    const referrerId = owner.customerId as string;
    if (referrerId === customerId) return fail(AppErrors.validation("You cannot use your own code.", { reason: "OWN_CODE" }));
    const referrer = await customer(referrerId);
    if (!referrer || referrer.status === "blocked") return fail(AppErrors.validation("This code is not valid any more.", { reason: "BAD_CODE" }));
    if (await ReferralModel.exists({ referrerId: customerId, refereeId: referrerId })) return fail(AppErrors.validation("You cannot use the code of a friend who joined with your code.", { reason: "TWO_WAY" }));

    const st = (await astroSettingsService.get()).referral;
    const at = nowIso();
    const flags: string[] = [];
    if (ctx.ip && (await ReferralModel.countDocuments({ referrerId, ip: ctx.ip, appliedAt: { $gte: new Date(Date.now() - 30 * DAY).toISOString() } })) >= SAME_IP_LIMIT) flags.push("same_network");
    try {
      await ReferralModel.create({
        referrerId, refereeId: customerId, code, referrerName: firstName(referrer.name), refereeName: firstName(c.name),
        status: "pending", referrerRewardPaise: Math.round(st.referrerReward * 100), refereeRewardPaise: Math.round(st.refereeReward * 100),
        minRechargePaise: Math.round(st.minRecharge * 100), flags, ip: ctx.ip.slice(0, 64), appliedAt: at,
        expiresAt: new Date(Date.now() + st.qualifyWithinDays * DAY).toISOString(),
      });
    } catch (e) {
      if (!isDup(e)) throw e;
      return fail(AppErrors.validation("You have already used a friend's code.", { reason: "ALREADY_APPLIED" }));
    }
    return this.mine(customerId);
  },

  /** Called after a paid recharge is credited. Qualifies a pending referral once. */
  async onRecharge(customerId: string, rechargeId: string, amountPaise: number): Promise<void> {
    const { ReferralModel } = await M();
    const at = nowIso();
    const r = await ReferralModel.findOne({ refereeId: customerId, status: "pending" }).lean<Doc>();
    if (!r) return;
    if (Date.parse(r.expiresAt as string) < Date.now()) {
      await ReferralModel.updateOne({ _id: r._id, status: "pending" }, { $set: { status: "expired" } });
      return;
    }
    if (amountPaise < (r.minRechargePaise as number)) return; // a smaller recharge does not count; a later one can
    const st = (await astroSettingsService.get()).referral;
    const month = istMonth(at);
    const used = await ReferralModel.countDocuments({ referrerId: r.referrerId, rewardMonth: month, referrerCapped: false, status: { $in: ["qualified", "rewarded"] } });
    const capped = used >= st.monthlyCap;
    const held = (r.flags as string[] | undefined)?.length ? "review" : "qualified";
    const q = await ReferralModel.findOneAndUpdate(
      { _id: r._id, status: "pending" },
      { $set: { status: held, qualifiedAt: at, rechargeId, rechargePaise: amountPaise, rewardMonth: month, referrerCapped: capped } },
      { new: true },
    ).lean<Doc>();
    if (q && held === "qualified") await reward(q);
  },

  /** Finish interrupted rewards and expire old pending ones (runs with the internal sweep). */
  async sweep(): Promise<{ rewarded: number; expired: number }> {
    const { ReferralModel } = await M();
    const stuck = await ReferralModel.find({ status: "qualified", qualifiedAt: { $lte: new Date(Date.now() - 60_000).toISOString() } }).limit(200).lean<Doc[]>();
    for (const r of stuck) await reward(r).catch(() => undefined);
    const ex = await ReferralModel.updateMany({ status: "pending", expiresAt: { $lt: nowIso() } }, { $set: { status: "expired" } });
    return { rewarded: stuck.length, expired: ex.modifiedCount };
  },

  /* ---------- admin ---------- */

  async adminList(f: { status?: string; q?: string; before?: string }): Promise<{ items: (Record<string, unknown> & { id: string })[]; stats: Record<string, number>; nextBefore: string | null }> {
    const { ReferralModel } = await M();
    const filter: Record<string, unknown> = {};
    if (f.status && ["pending", "qualified", "review", "rewarded", "expired", "rejected"].includes(f.status)) filter.status = f.status;
    const code = f.q ? normCode(f.q) : "";
    if (code) filter.code = code;
    if (f.before) filter.appliedAt = { $lt: f.before };
    const rows = await ReferralModel.find(filter).sort({ appliedAt: -1 }).limit(101).lean<Doc[]>();
    const agg = await ReferralModel.aggregate<{ _id: string; n: number; paid: number }>([
      { $group: { _id: "$status", n: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ["$status", "rewarded"] }, { $add: ["$refereeRewardPaise", { $cond: ["$referrerCapped", 0, "$referrerRewardPaise"] }] }, 0] } } } },
    ]);
    const stats: Record<string, number> = { total: 0, paidPaise: 0 };
    for (const a of agg) { stats[a._id] = a.n; stats.total += a.n; stats.paidPaise += a.paid; }
    const items = rows.slice(0, 100).map((r) => ({
      id: String(r._id), code: r.code, referrerId: r.referrerId, refereeId: r.refereeId, referrerName: r.referrerName, refereeName: r.refereeName,
      status: r.status, flags: r.flags ?? [], appliedAt: r.appliedAt, expiresAt: r.expiresAt, qualifiedAt: r.qualifiedAt, rewardedAt: r.rewardedAt,
      rechargePaise: r.rechargePaise ?? 0, referrerRewardPaise: r.referrerRewardPaise, refereeRewardPaise: r.refereeRewardPaise, referrerCapped: r.referrerCapped === true,
      reviewNote: r.reviewNote ?? "", reviewedBy: r.reviewedBy ?? "",
    }));
    return { items, stats, nextBefore: rows.length > 100 ? (items[items.length - 1].appliedAt as string) : null };
  },

  /** Approve a held referral (pays both) or reject a pending / held one (pays nothing). */
  async adminDecide(id: string, decision: "approve" | "reject", note: string, adminName: string): Promise<Result<{ status: ReferralStatus }>> {
    if (!/^[a-f0-9]{24}$/i.test(id)) return fail(AppErrors.notFound("Referral not found"));
    const { ReferralModel } = await M();
    const r = await ReferralModel.findById(id).lean<Doc>();
    if (!r) return fail(AppErrors.notFound("Referral not found"));
    if (decision === "approve") {
      const q = await ReferralModel.findOneAndUpdate({ _id: id, status: "review" }, { $set: { status: "qualified", reviewNote: note.slice(0, 300), reviewedBy: adminName } }, { new: true }).lean<Doc>();
      if (!q) return fail(AppErrors.validation("Only a referral held for review can be approved."));
      await reward(q);
    } else {
      const q = await ReferralModel.findOneAndUpdate({ _id: id, status: { $in: ["pending", "review"] } }, { $set: { status: "rejected", reviewNote: note.slice(0, 300), reviewedBy: adminName, rewardedAt: null } }, { new: true }).lean<Doc>();
      if (!q) return fail(AppErrors.validation("Only a pending or held referral can be rejected. Paid bonuses are not taken back."));
    }
    await auditService.record({ action: "status", entity: "customer", entityId: r.refereeId as string, entityLabel: `Referral ${r.code}`, summary: `Referral ${r.code} (${r.referrerName} → ${r.refereeName}) ${decision === "approve" ? "approved and paid" : "rejected"}${note ? `: ${note.slice(0, 120)}` : ""}`, actor: adminName }).catch(() => undefined);
    const after = await ReferralModel.findById(id).select("status").lean<Doc>();
    return ok({ status: (after?.status as ReferralStatus) ?? "pending" });
  },
};
