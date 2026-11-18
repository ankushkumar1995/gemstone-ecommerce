/**
 * GET /api/v1/account/my-bookings  (customer, guarded; app + website)
 *   → { bookings }  the signed-in customer's pooja / havan and service bookings,
 *     newest first, customer-safe fields only.
 * The customerId comes from the session, never from the request.
 */

import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { myBookingsService } from "@/modules/my-bookings";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:my-bookings:${guard.value.customerId}`, { limit: 120, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
  const res = await myBookingsService.list(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  const out = jsonOk(res.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
