/**
 * Consultations (chat) — types.
 *
 * Lifecycle
 *   requested ──accept──▶ active ──end / low balance / idle──▶ ended
 *       │ decline ▶ declined   │ no reply in time ▶ ended (no charge)
 *       │ timeout ▶ missed
 *       │ customer cancels ▶ cancelled
 *
 * Billing (prepaid per minute, like every large consult app)
 *   • Minute k is charged when it STARTS, counted from `billFrom` (the
 *     astrologer's first reply when "bill from first reply" is on).
 *   • A minute is charged only while the customer is still connected; a
 *     customer who vanished is never billed for time they were not there.
 *   • Each minute has its own wallet key `consult:<id>:m<k>`, so a retry, two
 *     servers or two tabs can never charge the same minute twice.
 *   • The first `freeMinutes` are not charged (first-ever session offer).
 *   • The wallet running out at a minute start ends the session at once.
 */

export type ConsultStatus = "requested" | "active" | "ended" | "declined" | "missed" | "cancelled";
export type ConsultRole = "customer" | "astrologer";
export type EndReason =
  | "customer" | "astrologer" | "low_balance" | "customer_left" | "astrologer_left" | "no_reply"
  | "declined" | "missed" | "cancelled" | "admin" | "insufficient";

export interface ConsultIntake { name: string; dob: string; birthTime: string; birthPlace: string; gender: string }

export interface ConsultSession {
  id: string;
  sessionNumber: string;
  requestId?: string;
  channel: "chat";
  status: ConsultStatus;
  customerId: string;
  customer: { name: string };
  astrologerId: string;
  astrologer: { name: string; photo: string | null; slug: string };
  intake: ConsultIntake | null;
  question: string;
  /** ₹ per minute, locked when the request is made. */
  rate: number;
  commissionPct: number;
  freeMinutes: number;
  openAstro: string | null;
  openCustomer: string | null;
  requestedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  firstReplyAt: string | null;
  billFrom: string | null;
  endedAt: string | null;
  endReason: EndReason | null;
  lastSeen: { customer?: string; astrologer?: string };
  typing: { customer?: string; astrologer?: string };
  read: { customer?: number; astrologer?: number };
  msgSeq: number;
  /** Minute slots consumed (free + paid). */
  minutesCharged: number;
  freeUsed: number;
  chargedPaise: number;
  refundedPaise: number;
  earningPaise: number;
  platformPaise: number;
  lowBalance: boolean;
  rating: { stars: number; text: string; at: string; status: "pending" | "approved" | "rejected" } | null;
  /** Tips after the chat (100% to the astrologer). */
  tipPaise?: number;
  tips?: { requestId: string; amountPaise: number; at: string }[];
  reports: { by: ConsultRole; reason: string; at: string }[];
  version: number;
}

export interface ConsultMessage { id: string; seq: number; from: ConsultRole | "system"; text: string; masked: boolean; at: string; clientId?: string }
