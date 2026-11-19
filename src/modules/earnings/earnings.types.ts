/**
 * Astrologer earnings and payouts.
 *
 * Ledger (append-only, one row per money event, idempotent on `key`)
 *   consultation  +net   chat earning after commission      key consult:<sessionId>
 *   gift          +net   live gift after commission         key gift:<liveId>:<clientId>
 *   super_chat    +net   answered Super Chat on a live      key superchat:<queueId>
 *   tip           +net   tip after a chat (100%)            key tip:<sessionId>:<requestId>
 *   remedy        +net   commission on a suggested item     key remedy:<saleId>
 *   remedy_reversal −net that sale was refunded later      key remedy-rev:<saleId>
 *   refund        −net   share of a customer refund         key refund:<sessionId>:<requestId>
 *   adjustment    ±      admin correction with a reason     key adjust:<requestId>
 *   payout        −gross money withdrawn                    key payout:<payoutId>
 *   payout_reversal +gross payout rejected / failed        key payout-reversal:<payoutId>
 *
 * Earnings are "on hold" until `availableAt` (holdDays after the event, the
 * refund / dispute window), then withdrawable. Debits count at once, so the
 * available balance can go below zero after a late refund; the next earnings
 * pay it back first.
 *
 * Payouts: requested → approved → (processing →) paid
 *                     ↘ rejected / cancelled / failed  (money goes back)
 * Only one open payout per astrologer (unique `openKey`).
 */

export type LedgerType = "consultation" | "gift" | "super_chat" | "tip" | "remedy" | "remedy_reversal" | "refund" | "adjustment" | "payout" | "payout_reversal";

export interface LedgerEntry {
  id: string;
  key: string;
  astrologerId: string;
  type: LedgerType;
  /** What the customer paid (earning rows). */
  grossPaise: number;
  commissionPaise: number;
  /** Signed: + adds to the balance, − takes from it. */
  netPaise: number;
  /** When this row becomes withdrawable. */
  availableAt: string;
  at: string;
  ref: { kind: "consultation" | "live" | "payout" | "admin" | "remedy"; id: string; label: string };
  note: string;
  actor: string;
}

export interface EarningsBalance {
  /** Withdrawable now (can be negative after a late refund). */
  availablePaise: number;
  /** Earned but still in the hold period. */
  onHoldPaise: number;
  /** In a payout that is not paid yet. */
  inPayoutPaise: number;
  /** All net earnings ever (consultations, gifts, tips, minus refunds, adjustments). */
  lifetimePaise: number;
  /** Paid out to the bank. */
  paidOutPaise: number;
  /** When the next held amount becomes withdrawable. */
  nextReleaseAt: string | null;
  nextReleasePaise: number;
}

export type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "failed" | "rejected" | "cancelled";

export interface PayoutDestination {
  method: "bank" | "upi";
  accountHolder?: string;
  accountNumberMasked?: string;
  ifsc?: string;
  bankName?: string;
  upiId?: string;
}

export interface Payout {
  id: string;
  payoutNumber: string;
  astrologerId: string;
  astrologer: { name: string; email: string };
  /** Taken from the balance. */
  amountPaise: number;
  tdsRatePct: number;
  tdsPaise: number;
  /** Sent to the bank = amount − TDS. */
  netPaise: number;
  pan: string | null;
  destination: PayoutDestination;
  status: PayoutStatus;
  requestedBy: "astrologer" | "auto" | "admin";
  provider: "manual" | "razorpayx";
  providerPayoutId: string | null;
  providerStatus: string | null;
  utr: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  history: { at: string; status: PayoutStatus; by: string; note?: string }[];
}
