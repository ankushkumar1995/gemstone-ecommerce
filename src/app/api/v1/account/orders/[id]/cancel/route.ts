/**
 * /api/v1/account/orders/:id/cancel  (customer, guarded)
 *   POST → cancel the signed-in customer's own order (pre-ship only).
 *
 * Ownership + stage are enforced in the service: the order must belong to the
 * session customer and still be pending/confirmed. Stock is restocked and
 * lifetime stats reverted via the normal status transition.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { orderService } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const { id } = await params;

  const res = await orderService.cancelByCustomer(id, guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({
    orderNumber: res.value.orderNumber,
    status: res.value.status,
    paymentStatus: res.value.paymentStatus,
  });
}
