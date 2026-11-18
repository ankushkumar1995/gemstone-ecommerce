import "server-only";

/**
 * RazorpayX payouts (automatic bank / UPI transfers to astrologers). Server-only.
 *
 * Off unless RAZORPAYX_ACCOUNT_NUMBER and keys are set AND the admin picks
 * "RazorpayX" as the payout provider. Every payout call carries an
 * idempotency key (our payout id), so a retry can never pay twice.
 * Status changes arrive by webhook (payout.processed / failed / reversed);
 * `getPayout` is the fallback the admin can use to refresh.
 */
import crypto from "node:crypto";
import { env } from "@/core/config/env";

const BASE = "https://api.razorpay.com/v1";

const keyId = () => env.RAZORPAYX_KEY_ID ?? env.RAZORPAY_KEY_ID;
const keySecret = () => env.RAZORPAYX_KEY_SECRET ?? env.RAZORPAY_KEY_SECRET;

export function razorpayxConfigured(): boolean {
  return Boolean(keyId() && keySecret() && env.RAZORPAYX_ACCOUNT_NUMBER);
}

export class RazorpayxError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); this.name = "RazorpayxError"; }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString("base64");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const j = (await res.json().catch(() => null)) as (T & { error?: { description?: string; code?: string } }) | null;
    if (!res.ok) throw new RazorpayxError(j?.error?.description ?? `RazorpayX error ${res.status}`, res.status, j?.error?.code);
    return j as T;
  } finally {
    clearTimeout(t);
  }
}

export interface RzpxPayout { id: string; status: "queued" | "pending" | "processing" | "processed" | "reversed" | "cancelled" | "rejected" | "failed"; utr: string | null; failure_reason?: string | null; status_details?: { description?: string } | null }

export async function createContact(input: { name: string; email?: string; contact?: string; referenceId: string }): Promise<string> {
  const r = await call<{ id: string }>("POST", "/contacts", { name: input.name.slice(0, 50), email: input.email, contact: input.contact, type: "vendor", reference_id: input.referenceId.slice(0, 40) });
  return r.id;
}

export async function createFundAccount(contactId: string, dest: { method: "bank"; name: string; ifsc: string; accountNumber: string } | { method: "upi"; upiId: string }): Promise<string> {
  const body = dest.method === "bank"
    ? { contact_id: contactId, account_type: "bank_account", bank_account: { name: dest.name.slice(0, 120), ifsc: dest.ifsc, account_number: dest.accountNumber } }
    : { contact_id: contactId, account_type: "vpa", vpa: { address: dest.upiId } };
  const r = await call<{ id: string }>("POST", "/fund_accounts", body);
  return r.id;
}

/** Send money. `idempotencyKey` = our payout id: the same key never pays twice. */
export async function createPayout(input: { fundAccountId: string; amountPaise: number; mode: "IMPS" | "NEFT" | "UPI"; referenceId: string; narration: string; idempotencyKey: string }): Promise<RzpxPayout> {
  return call<RzpxPayout>("POST", "/payouts", {
    account_number: env.RAZORPAYX_ACCOUNT_NUMBER,
    fund_account_id: input.fundAccountId,
    amount: input.amountPaise,
    currency: "INR",
    mode: input.mode,
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: input.referenceId.slice(0, 40),
    narration: input.narration.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 30),
  }, { "X-Payout-Idempotency": input.idempotencyKey });
}

export async function getPayout(id: string): Promise<RzpxPayout> {
  return call<RzpxPayout>("GET", `/payouts/${encodeURIComponent(id)}`);
}

/** Check the X-Razorpay-Signature of a RazorpayX webhook. */
export function verifyRazorpayxWebhook(rawBody: string, signature: string | null): boolean {
  const secret = env.RAZORPAYX_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const want = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(want), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
