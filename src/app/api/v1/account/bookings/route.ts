/**
 * /api/v1/account/bookings  (customer, guarded)
 *   GET → the signed-in customer's own service bookings, newest first.
 */

import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { bookingService } from "@/modules/bookings";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const res = await bookingService.listByCustomer(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ bookings: res.value });
}
