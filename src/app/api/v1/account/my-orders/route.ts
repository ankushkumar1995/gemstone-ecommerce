/**
 * GET /api/v1/account/my-orders  (customer, guarded; app)
 *   → { orders } the customer's product orders, newest first, customer-safe
 *     (steps, tracking, refund, cancel option).
 */
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { myOrdersService } from "@/modules/orders/my-orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:my-orders:${guard.value.customerId}`, { limit: 120, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
  const r = await myOrdersService.list(guard.value.customerId);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
