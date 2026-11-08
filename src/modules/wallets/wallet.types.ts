/**
 * Customer wallet — types.
 *
 * Money is ALWAYS integer paise (₹25 = 2500). Two buckets:
 *   • cash  — money the customer paid (refundable)
 *   • promo — bonus / goodwill credit (spent first, never paid out in cash)
 *
 * Every change is a WalletTxn in an append-only ledger, keyed by a unique
 * `key` so a retried or raced operation is applied exactly once.
 */

export type WalletTxnType =
  | "recharge" // paid top-up (cash) + its bonus (promo)
  | "consultation" // per-minute consultation charge
  | "refund" // money returned (e.g. consultation refund)
  | "adjustment" // manual admin credit/debit
  | "reversal"; // correction of an earlier txn

export const WALLET_TXN_TYPES = ["recharge", "consultation", "refund", "adjustment", "reversal"] as const;

export interface WalletBalance {
  customerId: string;
  cashPaise: number;
  promoPaise: number;
  updatedAt: string;
}

export interface WalletTxn {
  id: string;
  /** Idempotency key, unique across the ledger (e.g. "rzp:pay_123", "ses:abc:m3"). */
  key: string;
  customerId: string;
  type: WalletTxnType;
  /** Signed totals (+ credit, − debit) per bucket. */
  cashPaise: number;
  promoPaise: number;
  /** Balance right after this txn (for statements and audits). */
  cashAfter: number;
  promoAfter: number;
  /** What this txn is about (session id, recharge id, …). */
  ref?: string;
  note: string;
  /** "Customer" | "System" | admin name. */
  actor: string;
  at: string;
}

export type RechargeStatus = "created" | "paid" | "failed";

export interface WalletRecharge {
  id: string;
  customerId: string;
  /** Amount credited to the cash bucket. */
  amountPaise: number;
  bonusPaise: number;
  /** GST charged on top (0 when GST is off). */
  gstPaise: number;
  /** What the customer pays: amount + GST. */
  payablePaise: number;
  status: RechargeStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  paidAt?: string;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => Math.round(paise) / 100;
