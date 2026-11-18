/**
 * /api/v1/payments/razorpay/order  (website checkout, online payment)
 *   POST → place a PENDING order (stock held 15 min) + a Razorpay order for the
 *          exact server-side total, then return what Checkout needs.
 *
 * SECURITY
 *   • Login required; customerId comes from the session only.
 *   • Prices, discount, shipping and tax are computed on the server (the
 *     client only sends items / coupon / address).
 *   • The order is confirmed only after the signature verifies at /verify,
 *     the webhook arrives, or the status poll finds a captured payment.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { createOrderSchema } from "@/modules/orders";
import { startOnline } from "@/modules/orders/order-checkout.service";
import { websitePlaceInput } from "@/modules/orders/checkout.web";
import { requireCustomer } from "@/modules/customer-auth";
import { razorpayConfigured } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) return jsonError(AppErrors.validation("Online payments are not available right now."));
  const rl = rateLimit(`pay:rzp:order:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const body = await request.json().catch(() => null);
  const parsed = parse(createOrderSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  const res = await startOnline(guard.value.customerId, websitePlaceInput(parsed.value, "online", (body as { requestId?: unknown } | null)?.requestId), channelOf(request.headers));
  if (!res.ok) return jsonError(res.error);
  const { order, razorpayOrderId, amount, currency, keyId } = res.value;
  return jsonOk({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount,
    currency,
    razorpayOrderId,
    keyId,
    holdUntil: order.holdUntil ?? null,
    customer: order.customer,
  });
}
