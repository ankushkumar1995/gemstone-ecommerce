/**
 * /api/v1/account/orders  (customer, guarded)
 *   GET → the signed-in customer's own orders, newest first.
 *
 * Scoped strictly to the session customerId — a customer can only ever see
 * their own order history.
 */

import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { orderService } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const res = await orderService.listByCustomer(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ orders: res.value });
}
