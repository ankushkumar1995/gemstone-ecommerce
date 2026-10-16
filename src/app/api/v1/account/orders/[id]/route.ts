/**
 * /api/v1/account/orders/:id  (customer, guarded)
 *   GET → a single order that belongs to the signed-in customer (for invoice /
 *         detail). Ownership enforced — a customer can't read another's order.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { orderService } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const { id } = await params;

  const res = await orderService.getById(id);
  if (!res.ok) return jsonError(res.error);
  if (res.value.customerId !== guard.value.customerId) {
    return jsonError(AppErrors.forbidden("This order doesn't belong to your account"));
  }
  return jsonOk({ order: res.value });
}
