/**
 * Remedy suggestions in chat.
 *
 * Flow
 *   1. During a live chat the astrologer picks a shop product or a pooja and
 *      sends it as a card. The commission % (program settings) is fixed on the
 *      suggestion at that moment, so a later settings change never changes
 *      what was promised.
 *   2. Attribution: when the same customer pays for that item within
 *      `attributionDays` of the suggestion, a sale is recorded for the
 *      astrologer. If several astrologers suggested the same item, the most
 *      recent suggestion before the purchase wins (last touch).
 *   3. Sale lifecycle
 *        pending ──delivered / pooja done + confirmAfterDays──▶ confirmed (ledger +commission)
 *           │                                                     │ refunded later
 *           └──cancelled / refunded / admin──▶ reversed            └──▶ reversed (ledger −commission)
 *
 * Everything is reconciled by reading the order / booking itself (sweep), so a
 * status changed from any screen (admin, customer cancel, refund, sweep) is
 * picked up. Ledger writes are idempotent on their keys.
 */

export type RemedyKind = "product" | "pooja";

export interface RemedySuggestion {
  id: string;
  sessionId: string;
  sessionNumber: string;
  astrologerId: string;
  astrologerName: string;
  customerId: string;
  /** First name only. */
  customerName: string;
  kind: RemedyKind;
  itemId: string;
  slug: string;
  name: string;
  image: string;
  /** ₹ at the time of the suggestion. */
  price: number;
  mrp: number | null;
  note: string;
  commissionPct: number;
  /** 0 = no cap. */
  maxCommissionPaise: number;
  clientId: string;
  msgSeq: number | null;
  at: string;
  expiresAt: string;
  /** Sales attributed to this suggestion. */
  sales: number;
}

export type RemedySaleStatus = "pending" | "confirmed" | "reversed";
/** pending split for display: waiting for delivery / pooja, or in the return window. */
export type RemedySaleStage = "waiting" | "in_window" | "confirmed" | "reversed";

export interface RemedySale {
  id: string;
  key: string;
  suggestionId: string;
  sessionId: string;
  sessionNumber: string;
  astrologerId: string;
  astrologerName: string;
  customerId: string;
  customerName: string;
  kind: RemedyKind;
  itemId: string;
  itemName: string;
  image: string;
  source: { kind: "order" | "pooja_booking"; id: string; number: string };
  qty: number;
  /** What the customer paid for this item (after discount, before shipping / tax). */
  basePaise: number;
  commissionPct: number;
  commissionPaise: number;
  status: RemedySaleStatus;
  stage: RemedySaleStage;
  /** When the commission becomes final (null until delivered / pooja done). */
  confirmAt: string | null;
  confirmedAt: string | null;
  reversedAt: string | null;
  reason: string;
  boughtAt: string;
  createdAt: string;
  history: { at: string; status: RemedySaleStatus | "attributed" | "updated"; note: string; by: string }[];
}

/** An item the astrologer can suggest (picker). */
export interface RemedyCatalogItem {
  kind: RemedyKind;
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  mrp: number | null;
  /** Planet / category, for the picker. */
  tag: string;
  inStock: boolean;
  /** Commission on one unit at today's price (paise). */
  commissionPaise: number;
}

export interface RemedyRules {
  enabled: boolean;
  commissionPct: number;
  attributionDays: number;
  confirmAfterDays: number;
  allowProducts: boolean;
  allowPoojas: boolean;
  maxPerChat: number;
  maxCommissionPaise: number;
}

export interface RemedyStats {
  sales: number;
  pendingPaise: number;
  confirmedPaise: number;
  reversedPaise: number;
  suggestions: number;
}
