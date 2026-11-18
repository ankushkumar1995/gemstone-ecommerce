/**
 * POST /api/v1/payments/razorpay/pooja-verify  (customer, signed in)
 *   { razorpayOrderId, razorpayPaymentId, razorpaySignature } → settles the booking exactly once.
 * Only the booking's own customer can confirm it. A bad signature changes nothing.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { poojaPaymentService } from "@/modules/poojas";
import { getPoojaRepository } from "@/modules/poojas/pooja.repository";
import { verifyPaymentSignature } from "@/core/razorpay";

export const dynamic = "force-dynamic";
const schema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(100),
  razorpayPaymentId: z.string().trim().min(1).max(100),
  razorpaySignature: z.string().trim().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const rl = rateLimit(`pay:rzp:pverify:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Try again shortly."));
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const parsed = parse(schema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.value;

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) return jsonError(AppErrors.validation("Payment verification failed"));
  const own = await getPoojaRepository().findBookingByRazorpayOrder(razorpayOrderId);
  if (!own || own.customer.customerId !== guard.value.customerId) return jsonError(AppErrors.notFound("Booking not found"));

  const r = await poojaPaymentService.settle(razorpayOrderId, razorpayPaymentId);
  if (!r.ok) return jsonError(r.error);
  const b = r.value.booking;
  return jsonOk({ outcome: r.value.outcome, bookingNumber: b.bookingNumber, status: b.status, paymentStatus: b.payment.status, total: b.pricing.total, refunded: b.payment.refunded });
}
