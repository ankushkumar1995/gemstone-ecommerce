/**
 * /api/v1/orders
 *   GET  → list all orders
 *   POST → create an order (admin / checkout)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { orderController } from "@/modules/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => orderController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return orderController.create(body);
  });
}
