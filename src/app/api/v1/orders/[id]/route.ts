/**
 * /api/v1/orders/:id
 *   GET   → single order
 *   PATCH → edit details (shipping address / notes)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { orderController } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return orderController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return orderController.updateDetails(id, body);
  });
}
