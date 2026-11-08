/**
 * /api/v1/poojas/bookings  (public)
 *   POST → customer booking request from the website.
 *
 * No payment here. The booking is saved as "payment pending" and shows up in
 * Admin → Pooja → Bookings; the team calls to confirm and collect payment.
 * Price, discount, overbooking and cutoff are decided on the server only.
 * Signed-in customers are linked to the booking; guests are welcome.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { poojaBookingService, webBookingSchema } from "@/modules/poojas";
import { requireCustomer } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`pooja:book:${clientIp(request.headers)}`, { limit: 10, windowSeconds: 10 * 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many requests. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

    const body = await request.json().catch(() => null);
    const parsed = parse(webBookingSchema, body);
    if (!parsed.ok) return jsonError(parsed.error);

    const session = await requireCustomer();
    const res = await poojaBookingService.createFromWeb(parsed.value, session.ok ? session.value.customerId : null);
    if (!res.ok) return jsonError(res.error);

    // Only what the customer needs to see.
    const b = res.value;
    return jsonOk({
      bookingNumber: b.bookingNumber,
      pooja: b.pooja.title,
      package: b.package.name,
      date: b.slot.date,
      time: b.slot.time,
      label: b.slot.label,
      total: b.pricing.total,
    }, 201);
  }, request);
}
