/**
 * POST /api/v1/payments/razorpayx/webhook  (RazorpayX → us)
 *   payout.processed / payout.failed / payout.reversed / payout.rejected / payout.updated
 *   Signature: X-Razorpay-Signature (HMAC-SHA256 of the raw body, RAZORPAYX_WEBHOOK_SECRET).
 *   Unknown payouts are acknowledged (200) so RazorpayX does not retry forever.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { verifyRazorpayxWebhook } from "@/core/razorpayx";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyRazorpayxWebhook(raw, request.headers.get("x-razorpay-signature"))) return jsonError(AppErrors.unauthorized("Bad signature"));
  let body: { event?: string; payload?: { payout?: { entity?: Record<string, unknown> } } } = {};
  try { body = JSON.parse(raw); } catch { return jsonError(AppErrors.validation("Bad JSON")); }
  const e = body.payload?.payout?.entity;
  if (!body.event?.startsWith("payout.") || !e) return jsonOk({ ignored: true });
  const handled = await earningsService.onRazorpayxEvent({
    id: String(e.id ?? ""), status: String(e.status ?? ""), utr: (e.utr as string) ?? null,
    reference_id: (e.reference_id as string) ?? undefined, failure_reason: (e.failure_reason as string) ?? null,
    status_details: (e.status_details as { description?: string }) ?? null,
  });
  return jsonOk({ handled });
}
