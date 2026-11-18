/**
 * /api/v1/account/orders/:id/cancel  (website account)
 *   POST → cancel the signed-in customer's own order (before it is packed).
 *          A paid online order is refunded in full to the original payment
 *          method; stock goes back. Same rules as the app.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { orderService } from "@/modules/orders";
import { customerCancelOrder } from "@/modules/orders/order-checkout.service";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const { id } = await params;
  const found = await orderService.getById(id);
  if (!found.ok || found.value.customerId !== guard.value.customerId) return jsonError(AppErrors.notFound("Order not found"));
  const res = await customerCancelOrder(guard.value.customerId, found.value.orderNumber, "source");
  if (!res.ok) return jsonError(res.error);
  return jsonOk({
    orderNumber: res.value.orderNumber,
    status: res.value.status,
    paymentStatus: res.value.paymentStatus,
  });
}
