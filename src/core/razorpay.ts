import "server-only";

/**
 * Razorpay gateway helper (server-only).
 * ─────────────────────────────────────────────────────────────────────────
 * Thin, dependency-free wrapper over Razorpay's REST API + the HMAC-SHA256
 * signature scheme. We deliberately avoid the `razorpay` npm SDK:
 *   • one less dependency / supply-chain surface
 *   • works on the Node runtime with the built-in `crypto` + `fetch`
 *
 * SECURITY NOTES
 *   • KEY_SECRET and WEBHOOK_SECRET never leave the server.
 *   • The amount sent to Razorpay is ALWAYS computed server-side from the
 *     persisted order — never trusted from the client.
 *   • Payment success is only honoured after the signature verifies, using a
 *     constant-time comparison (crypto.timingSafeEqual) to avoid timing leaks.
 */

import crypto from "node:crypto";
import { env } from "@/core/config/env";

const API_BASE = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
  id: string;
  amount: number; // in paise
  currency: string;
  status: string;
  receipt?: string;
}

/** Is the gateway configured (both id + secret present)? */
export function razorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** The publishable key id — safe to send to the browser. */
export function razorpayKeyId(): string | undefined {
  return env.RAZORPAY_KEY_ID;
}

function authHeader(): string {
  const raw = `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/**
 * Create a Razorpay order. `amountInRupees` is converted to paise (integer).
 * `receipt` is our own reference (the order number) for reconciliation.
 */
export async function createRazorpayOrder(params: {
  amountInRupees: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!razorpayConfigured()) {
    throw new Error("Razorpay is not configured");
  }
  const amountPaise = Math.round(params.amountInRupees * 100);
  if (!Number.isFinite(amountPaise) || amountPaise < 100) {
    // Razorpay rejects amounts below ₹1.00 (100 paise).
    throw new Error("Invalid payment amount");
  }

  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: params.currency ?? "INR",
      receipt: params.receipt,
      payment_capture: 1, // auto-capture on success
      notes: params.notes ?? {},
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay order creation failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Constant-time string compare (both hex strings of equal length). */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verify the checkout callback signature:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 * must equal the razorpay_signature returned by Razorpay Checkout.
 */
export function verifyPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.razorpaySignature);
}

/**
 * Verify a webhook payload signature:
 *   HMAC_SHA256(rawBody, WEBHOOK_SECRET) === X-Razorpay-Signature header.
 * The RAW request body must be used (not re-stringified JSON).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeEqualHex(expected, signature);
}
