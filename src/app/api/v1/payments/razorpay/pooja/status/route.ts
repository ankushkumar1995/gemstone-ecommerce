/**
 * GET /api/v1/payments/razorpay/pooja/status?orderId=order_xxx  (customer, signed in)
 *   → PoojaPayStatus. Reconciles with Razorpay when our record is not paid yet,
 *     so a lost callback and a missed webhook still end correctly.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { maybeSweepHolds, poojaPaymentService } from "@/modules/poojas";
import { fetchOrderPayments, razorpayConfigured } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`pay:rzp:pstatus:${guard.value.customerId}`, { limit: 90, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Checking too often. Please wait a moment."));
  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return jsonError(AppErrors.validation("Invalid order id"));
  if (!razorpayConfigured()) return jsonError(AppErrors.validation("Online payments are not available right now."));
  maybeSweepHolds(fetchOrderPayments);
  const r = await poojaPaymentService.status(guard.value.customerId, orderId, fetchOrderPayments);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
