import "server-only";

/**
 * Wallet service — business rules on top of the repository primitive.
 *
 * Recharge flow (Razorpay, same trust model as orders/bookings):
 *   createRecharge → Razorpay order (server-computed amount)
 *   verify (signature) OR webhook → settleRecharge:
 *       1. credit cash + bonus with key `wrc:<rechargeId>`  (exactly once)
 *       2. mark the recharge paid
 *   Crediting first means a crash between the two steps is healed by the next
 *   callback/webhook: the credit is a duplicate (no double money) and the
 *   recharge gets marked paid.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { astroSettingsService } from "@/modules/astro-settings";
import { getWalletRepository, type ApplyResult } from "./wallet.repository";
import type { WalletBalance, WalletRecharge, WalletTxn, WalletTxnType } from "./wallet.types";
import { toPaise } from "./wallet.types";

export const CUSTOM_MIN_RUPEES = 50;
export const CUSTOM_MAX_RUPEES = 50_000;
/** Hard cap on any single admin adjustment (fat-finger guard). */
const ADJUST_MAX_PAISE = toPaise(100_000);

export interface WalletView extends WalletBalance {
  totalPaise: number;
  packs: { amount: number; bonus: number; tag?: string }[];
  gstPct: number;
  customMin: number;
  customMax: number;
}

export const walletService = {
  async view(customerId: string): Promise<WalletView> {
    const [bal, s] = await Promise.all([getWalletRepository().balance(customerId), astroSettingsService.get()]);
    return {
      ...bal, totalPaise: bal.cashPaise + bal.promoPaise,
      packs: s.rechargePacks.map((p) => ({ amount: p.amount, bonus: p.bonus, tag: p.tag || undefined })),
      gstPct: s.gst.enabled ? s.gst.ratePct : 0, customMin: CUSTOM_MIN_RUPEES, customMax: CUSTOM_MAX_RUPEES,
    };
  },

  balance: (customerId: string) => getWalletRepository().balance(customerId),

  async history(customerId: string, cursor?: string, type?: WalletTxnType): Promise<Result<{ items: WalletTxn[]; nextCursor: string | null }>> {
    return ok(await getWalletRepository().txns(customerId, { limit: 30, cursor, type }));
  },

  /** Price a recharge: a configured pack (with bonus) or a custom amount (no bonus). */
  async quote(input: { packAmount?: number; customAmount?: number }): Promise<Result<{ amountPaise: number; bonusPaise: number; gstPaise: number; payablePaise: number }>> {
    const s = await astroSettingsService.get();
    let amount: number;
    let bonus = 0;
    if (input.packAmount !== undefined) {
      const pack = s.rechargePacks.find((p) => p.amount === input.packAmount);
      if (!pack) return fail(AppErrors.validation("This recharge pack is no longer available"));
      amount = pack.amount;
      bonus = pack.bonus;
    } else if (input.customAmount !== undefined) {
      if (!Number.isInteger(input.customAmount) || input.customAmount < CUSTOM_MIN_RUPEES || input.customAmount > CUSTOM_MAX_RUPEES) {
        return fail(AppErrors.validation(`Enter a whole amount between ₹${CUSTOM_MIN_RUPEES} and ₹${CUSTOM_MAX_RUPEES.toLocaleString("en-IN")}`));
      }
      amount = input.customAmount;
    } else return fail(AppErrors.validation("Choose a recharge amount"));
    const amountPaise = toPaise(amount);
    const gstPaise = s.gst.enabled ? Math.round((amountPaise * s.gst.ratePct) / 100) : 0;
    return ok({ amountPaise, bonusPaise: toPaise(bonus), gstPaise, payablePaise: amountPaise + gstPaise });
  },

  async createRecharge(customerId: string, q: { amountPaise: number; bonusPaise: number; gstPaise: number; payablePaise: number }): Promise<WalletRecharge> {
    return getWalletRepository().createRecharge({ customerId, ...q });
  },
  attachOrder: (rechargeId: string, orderId: string) => getWalletRepository().attachOrder(rechargeId, orderId),
  rechargeByOrder: (orderId: string) => getWalletRepository().rechargeByOrder(orderId),
  recharges: (customerId: string) => getWalletRepository().rechargesFor(customerId, 20),

  /** Settle a verified payment. Safe to call many times (callback + webhook). */
  async settleRecharge(razorpayOrderId: string, razorpayPaymentId: string | undefined): Promise<Result<{ recharge: WalletRecharge; credited: boolean; balance: WalletBalance }>> {
    const repo = getWalletRepository();
    const r = await repo.rechargeByOrder(razorpayOrderId);
    if (!r) return fail(AppErrors.notFound("Recharge not found"));
    const res = await repo.apply({
      key: `wrc:${r.id}`, customerId: r.customerId, type: "recharge", cashPaise: r.amountPaise, promoPaise: r.bonusPaise || undefined,
      ref: r.id, note: r.bonusPaise ? `Recharge ₹${r.amountPaise / 100} + ₹${r.bonusPaise / 100} bonus` : `Recharge ₹${r.amountPaise / 100}`, actor: "Customer",
    });
    if (res.status === "insufficient") return fail(AppErrors.internal("Could not credit the wallet"));
    const marked = await repo.markRechargePaid(razorpayOrderId, razorpayPaymentId);
    const recharge = marked ?? (await repo.rechargeByOrder(razorpayOrderId)) ?? r;
    return ok({ recharge, credited: res.status === "applied", balance: res.balance });
  },

  /** Per-minute (or any) consultation charge. Idempotent on `key`. */
  async charge(customerId: string, key: string, paise: number, ref: string, note: string): Promise<ApplyResult> {
    return getWalletRepository().apply({ key, customerId, type: "consultation", debitPaise: paise, ref, note, actor: "System" });
  },

  /** Refund into the same buckets the money came from. Idempotent on `key`. */
  async refund(customerId: string, key: string, split: { cashPaise: number; promoPaise: number }, ref: string, note: string, actor: string): Promise<ApplyResult> {
    return getWalletRepository().apply({ key, customerId, type: "refund", cashPaise: split.cashPaise || undefined, promoPaise: split.promoPaise || undefined, ref, note, actor });
  },

  txnsByRef: (ref: string) => getWalletRepository().txnsByRef(ref),

  /** Manual admin credit/debit. Requires a reason; audited; idempotent via requestId. */
  async adjust(input: { customerId: string; bucket: "cash" | "promo"; direction: "credit" | "debit"; amountPaise: number; reason: string; requestId: string; adminName: string; customerLabel?: string }): Promise<Result<{ txn: WalletTxn; balance: WalletBalance }>> {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0 || input.amountPaise > ADJUST_MAX_PAISE) return fail(AppErrors.validation("Enter an amount between ₹0.01 and ₹1,00,000"));
    if (input.reason.trim().length < 5) return fail(AppErrors.validation("Give a reason (at least 5 characters)"));
    const signed = input.direction === "credit" ? input.amountPaise : -input.amountPaise;
    const res = await getWalletRepository().apply({
      key: `adj:${input.requestId}`, customerId: input.customerId, type: "adjustment",
      cashPaise: input.bucket === "cash" ? signed : undefined, promoPaise: input.bucket === "promo" ? signed : undefined,
      note: `${input.direction === "credit" ? "Credit" : "Debit"} by admin: ${input.reason.trim()}`.slice(0, 300), actor: input.adminName,
    });
    if (res.status === "insufficient") return fail(AppErrors.validation(`Not enough ${input.bucket} balance for this debit`));
    if (!res.txn || res.txn.customerId !== input.customerId) return fail(AppErrors.conflict("This request id was already used. Reload and try again."));
    if (res.status === "applied") {
      await auditService.record({ action: "payment", entity: "wallet", entityId: input.customerId, entityLabel: input.customerLabel ?? input.customerId, summary: `${input.direction} ₹${input.amountPaise / 100} (${input.bucket}): ${input.reason.trim()}`, actor: input.adminName });
    }
    return ok({ txn: res.txn, balance: res.balance });
  },
};
