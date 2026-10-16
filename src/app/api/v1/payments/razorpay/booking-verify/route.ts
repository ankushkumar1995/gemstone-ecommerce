/**
 * /api/v1/payments/razorpay/booking-verify  (storefront booking callback)
 *   POST → verify the Razorpay signature and settle the booking.
 *
 * Same trust boundary as the order verify: we ONLY mark a booking paid if the
 * HMAC signature matches, and only after confirming the gateway order id maps
 * to one of OUR bookings. markPaid is idempotent (webhook + callback safe).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { bookingService } from "@/modules/bookings";
import { verifyPaymentSignature } from "@/core/razorpay";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:bkverify:${ip}`, { limit: 30, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Try again shortly."));

  const body = await request.json().catch(() => null);
  const parsed = parse(verifySchema, body);
  if (!parsed.ok) return jsonError(parsed.error);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.value;

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    return jsonError(AppErrors.validation("Payment verification failed"));
  }

  const booking = await bookingService.findByRazorpayOrderId(razorpayOrderId);
  if (!booking) return jsonError(AppErrors.notFound("Booking not found"));

  const res = await bookingService.markPaid(booking.id, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!res.ok) return jsonError(res.error);

  const b = res.value;
  return jsonOk({
    bookingNumber: b.bookingNumber,
    serviceTitle: b.serviceTitle,
    placedAt: b.placedAt,
    paymentStatus: b.paymentStatus,
    status: b.status,
    amount: b.amount,
  });
}
