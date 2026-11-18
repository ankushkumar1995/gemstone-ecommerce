/**
 * POST /api/v1/checkout/place  (app; signed in)
 *   body: placeOrderSchema (items, couponCode, shippingAddress, method, requestId, contact?)
 *   method "cod"    → { order }                         confirmed, stock reserved
 *   method "online" → { order, razorpayOrderId, amount, currency, keyId }
 *                     pending, stock held 15 min; same requestId = same order + payment
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { requireCustomer } from "@/modules/customer-auth";
import { placeOrderSchema } from "@/modules/orders/checkout.schema";
import { placeOrder, startOnline } from "@/modules/orders/order-checkout.service";
import { myOrderView } from "@/modules/orders/my-orders";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`checkout:place:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const parsed = parse(placeOrderSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const v = parsed.value;
  const input = {
    items: v.items,
    couponCode: v.couponCode || undefined,
    shippingAddress: { ...v.shippingAddress, line2: v.shippingAddress.line2 || undefined, country: v.shippingAddress.country || "India" },
    method: v.method,
    requestId: v.requestId,
    contact: v.contact ? { name: v.contact.name, email: v.contact.email || undefined, phone: v.contact.phone } : undefined,
    notes: v.notes || undefined,
  };
  const channel = channelOf(request.headers);

  if (v.method === "cod") {
    const r = await placeOrder(guard.value.customerId, input, channel);
    if (!r.ok) return jsonError(r.error);
    if (r.value.paymentMethod !== "cod") return jsonError(AppErrors.conflict("This request was used for an online payment. Please place the order again."));
    return jsonOk({ order: myOrderView(r.value) }, 201);
  }
  const r = await startOnline(guard.value.customerId, input, channel);
  if (!r.ok) return jsonError(r.error);
  return jsonOk({ order: myOrderView(r.value.order), razorpayOrderId: r.value.razorpayOrderId, amount: r.value.amount, currency: r.value.currency, keyId: r.value.keyId }, 201);
}
