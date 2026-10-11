/**
 * /api/v1/orders/:id/status
 *   PATCH → change order status (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { orderController } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return orderController.updateStatus(id, body);
  });
}
