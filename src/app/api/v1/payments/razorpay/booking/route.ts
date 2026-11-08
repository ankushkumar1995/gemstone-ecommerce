/**
 * /api/v1/payments/razorpay/booking  (storefront service booking)
 *   POST → create a PENDING booking + a matching Razorpay order, then return
 *          the data the browser needs to open Razorpay Checkout.
 *
 * SECURITY (same model as the order route)
 *   • Login optional. Signed in: customerId comes from the session, never the
 *     body. Guest: name, email and phone come from the form.
 *   • The charged amount is the server-side service price (resolved inside the
 *     booking service) — the client cannot influence it.
 *   • The booking is created pending/unpaid; it's only confirmed once the
 *     payment signature verifies at /booking-verify (or via the webhook).
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { createBookingSchema, bookingService } from "@/modules/bookings";
import { requireCustomer } from "@/modules/customer-auth";
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) {
    return jsonError(AppErrors.validation("Online payments are not available right now."));
  }

  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:booking:${ip}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) {
    return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
  }

  const body = await request.json().catch(() => null);
  const parsed = parse(createBookingSchema, body);
  if (!parsed.ok) return jsonError(parsed.error);

  // Signed in → identity from the session (body customer is ignored).
  // Guest → name, email and phone from the form; email gets the confirmation.
  const guard = await requireCustomer();
  const customerId = guard.ok ? guard.value.customerId : undefined;
  const guest = customerId
    ? undefined
    : parsed.value.customer
      ? { ...parsed.value.customer, phone: parsed.value.customer.phone || parsed.value.intake.phone }
      : undefined;
  if (!customerId && !guest) {
    return jsonError(AppErrors.validation("Please enter your email so we can send the booking confirmation."));
  }
  // Storefront bookings must include these (admin-created bookings may not).
  if (!parsed.value.intake.gender) return jsonError(AppErrors.validation("Please select your gender"));
  if (!parsed.value.intake.maritalStatus) return jsonError(AppErrors.validation("Please select your marital status"));

  // Create the booking as PENDING + UNPAID (price resolved server-side).
  const created = await bookingService.create({
    ...parsed.value,
    customerId,
    customer: guest,
    paymentMethod: "razorpay",
    paymentStatus: "unpaid",
    status: "pending",
  });
  if (!created.ok) return jsonError(created.error);
  const booking = created.value;

  // Create the gateway order for the exact server-side amount.
  let rzpOrder;
  try {
    rzpOrder = await createRazorpayOrder({
      amountInRupees: booking.amount,
      receipt: booking.bookingNumber,
      notes: { bookingId: booking.id, bookingNumber: booking.bookingNumber, service: booking.serviceTitle },
    });
  } catch (e) {
    return jsonError(AppErrors.internal(e instanceof Error ? e.message : "Payment init failed"));
  }

  await bookingService.attachRazorpayOrder(booking.id, rzpOrder.id);

  return jsonOk({
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    serviceTitle: booking.serviceTitle,
    amount: rzpOrder.amount, // paise
    currency: rzpOrder.currency,
    razorpayOrderId: rzpOrder.id,
    keyId: razorpayKeyId(),
    customer: booking.customer,
  });
}
