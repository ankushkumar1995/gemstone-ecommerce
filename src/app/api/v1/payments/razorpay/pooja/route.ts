/**
 * POST /api/v1/payments/razorpay/pooja  (customer, signed in; app + website)
 *   body = the same booking input as /api/v1/poojas/bookings (incl. requestId)
 *   → { bookingNumber, total, holdUntil, razorpayOrderId, amount, currency, keyId }
 *
 * Creates the booking as "pending_payment" with the seat held for 15 minutes
 * and a Razorpay order for the exact server-side total. Retrying with the same
 * requestId returns the SAME booking and order (never a second seat or charge).
 * If the gateway order cannot be created, the booking is cancelled at once so
 * the seat is not blocked.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { requireCustomer } from "@/modules/customer-auth";
import { poojaBookingService, poojaPaymentService, webBookingSchema } from "@/modules/poojas";
import { getPoojaRepository } from "@/modules/poojas/pooja.repository";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) return jsonError(AppErrors.validation("Online payment is not available right now. Please choose Pay later."));
  const rl = rateLimit(`pay:rzp:pooja:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const parsed = parse(webBookingSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);

  const created = await poojaBookingService.createFromWeb(parsed.value, guard.value.customerId, channelOf(request.headers), true);
  if (!created.ok) return jsonError(created.error);
  let b = created.value;

  // Retried request: this booking already exists.
  if (b.customer.customerId !== guard.value.customerId) return jsonError(AppErrors.conflict("This request was already used. Please start again."));
  if (b.payment.status !== "unpaid") return jsonError(AppErrors.conflict(`This booking (${b.bookingNumber}) is already paid.`));
  if (b.status !== "pending_payment") return jsonError(AppErrors.conflict("This booking is no longer waiting for payment. Please start a new booking."));
  if (b.payment.method !== "razorpay") return jsonError(AppErrors.conflict("This booking was sent as a pay-later request. Our team will call you."));

  if (!b.payment.razorpayOrderId) {
    let order;
    try {
      order = await createRazorpayOrder({ amountInRupees: b.pricing.total, receipt: b.bookingNumber, notes: { poojaBookingId: b.id, bookingNumber: b.bookingNumber } });
    } catch (e) {
      // Do not block a seat for a payment that can never start.
      const repo = getPoojaRepository();
      const r = await repo.updateBooking(b.id, { status: "cancelled", cancelReason: "Online payment could not be started", holdUntil: null }, b.version);
      if (r && r !== "conflict") await repo.releaseSlot(b.poojaId, b.slot.key);
      return jsonError(AppErrors.internal(e instanceof Error ? `Could not start the payment: ${e.message.slice(0, 120)}` : "Could not start the payment."));
    }
    const att = await poojaPaymentService.attachOrder(b.id, order.id);
    if (!att.ok) return jsonError(att.error);
    b = att.value;
  }

  return jsonOk({
    bookingNumber: b.bookingNumber,
    pooja: b.pooja.title,
    package: b.package.name,
    date: b.slot.date,
    time: b.slot.time,
    label: b.slot.label,
    total: b.pricing.total,
    holdUntil: b.holdUntil ?? null,
    razorpayOrderId: b.payment.razorpayOrderId,
    amount: Math.round(b.pricing.total * 100),
    currency: "INR",
    keyId: razorpayKeyId(),
  });
}
