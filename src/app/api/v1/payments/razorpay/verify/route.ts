/**
 * /api/v1/payments/razorpay/verify  (storefront checkout callback)
 *   POST → verify the Razorpay Checkout signature and settle the order.
 *
 * SECURITY — this is the trust boundary. We ONLY mark an order paid if the
 * HMAC-SHA256 signature over "<razorpay_order_id>|<razorpay_payment_id>" with
 * our KEY_SECRET matches the signature Razorpay returned. A forged / replayed
 * callback fails verification and the order stays unpaid. We also confirm the
 * gateway order id belongs to one of OUR orders before touching anything.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { orderService } from "@/modules/orders";
import { verifyPaymentSignature } from "@/core/razorpay";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:verify:${ip}`, { limit: 30, windowSeconds: 10 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again shortly.`));
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(verifySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.value;

  // 1) Signature must verify — the only thing that proves the payment is real.
  const valid = verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
  if (!valid) {
    return jsonError(AppErrors.validation("Payment verification failed"));
  }

  // 2) The gateway order id must map to one of OUR orders.
  const order = await orderService.findByRazorpayOrderId(razorpayOrderId);
  if (!order) return jsonError(AppErrors.notFound("Order not found"));

  // 3) Settle (idempotent): mark paid + confirm + commit stock / stats.
  const res = await orderService.markPaid(order.id, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!res.ok) return jsonError(res.error);

  const o = res.value;
  return jsonOk({
    orderNumber: o.orderNumber,
    placedAt: o.placedAt,
    paymentStatus: o.paymentStatus,
    status: o.status,
    pricing: o.pricing,
    items: o.items,
  });
}
