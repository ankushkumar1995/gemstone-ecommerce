/**
 * /api/v1/payments/razorpay/order  (storefront checkout)
 *   POST → create a PENDING order + a matching Razorpay order, then return the
 *          data the browser needs to open Razorpay Checkout.
 *
 * SECURITY
 *   • The amount charged is the server-computed order grand total — the client
 *     cannot influence it (it only sends items / address / coupon).
 *   • customerId is derived from the session cookie (never the body), exactly
 *     like the normal order route, so an order can't be attached to someone
 *     else's account.
 *   • The order is created as pending/unpaid — NO stock is committed until the
 *     payment signature is verified at /verify (or via the webhook).
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { createOrderSchema, orderService } from "@/modules/orders";
import { productService } from "@/modules/products";
import { couponService } from "@/modules/coupons";
import { requireCustomer } from "@/modules/customer-auth";
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) {
    return jsonError(AppErrors.validation("Online payments are not available right now."));
  }

  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:order:${ip}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  // LOGIN REQUIRED — no guest checkout. Identity comes from the session only.
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const trustedCustomerId = guard.value.customerId;

  const body = await request.json().catch(() => null);
  const parsed = parse(createOrderSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  // ── Server-authoritative pricing ──────────────────────────────────────
  // NEVER trust client-sent discount / shipping / tax for a paid order. We
  // recompute the line subtotal from live product prices and, if a coupon was
  // supplied, re-validate it server-side to get the REAL discount. Shipping &
  // tax are then derived from store settings inside orderService.create (we
  // pass no overrides). This makes the charged amount impossible to tamper.
  let safeDiscount: number | undefined;
  let safeCouponCode: string | undefined;
  if (parsed.value.couponCode) {
    let subtotal = 0;
    for (const line of parsed.value.items) {
      const pRes = await productService.getById(line.productId);
      if (!pRes.ok) return jsonError(AppErrors.validation(`Product ${line.productId} not found`));
      const p = pRes.value;
      let unit = p.price;
      if (line.variantId) {
        const v = p.variants?.find((x) => x.id === line.variantId);
        if (!v) return jsonError(AppErrors.validation(`Variant not found for ${p.name}`));
        unit = v.price;
      }
      subtotal += unit * line.qty;
    }
    const couponRes = await couponService.validate(parsed.value.couponCode, subtotal, trustedCustomerId);
    if (!couponRes.ok) return jsonError(couponRes.error);
    safeCouponCode = couponRes.value.code;
    safeDiscount = couponRes.value.discount;
  }

  // Create the order as PENDING + UNPAID via the normal service (so pricing,
  // stock-availability checks, settings and the customer snapshot all run).
  // Note: discount/shipping/taxRate overrides from the client are dropped.
  const created = await orderService.create({
    items: parsed.value.items,
    shippingAddress: parsed.value.shippingAddress,
    billingAddress: parsed.value.billingAddress,
    notes: parsed.value.notes,
    customerId: trustedCustomerId,
    couponCode: safeCouponCode,
    discount: safeDiscount,
    paymentMethod: "razorpay",
    paymentStatus: "unpaid",
    status: "pending",
  });
  if (!created.ok) return jsonError(created.error);
  const order = created.value;

  // Create the gateway order for the exact server-side grand total.
  let rzpOrder;
  try {
    rzpOrder = await createRazorpayOrder({
      amountInRupees: order.pricing.grandTotal,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });
  } catch (e) {
    return jsonError(AppErrors.internal(e instanceof Error ? e.message : "Payment init failed"));
  }

  // Stash the gateway order id on our order so verify/webhook can match it.
  await orderService.attachRazorpayOrder(order.id, rzpOrder.id);

  return jsonOk({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: rzpOrder.amount, // paise
    currency: rzpOrder.currency,
    razorpayOrderId: rzpOrder.id,
    keyId: razorpayKeyId(),
    customer: order.customer,
  });
}
