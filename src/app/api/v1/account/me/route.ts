/**
 * /api/v1/account/me  (customer)
 *   GET → the signed-in customer's safe profile (guarded).
 */

import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer, customerAuthService } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const res = await customerAuthService.me(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ customer: res.value });
}
