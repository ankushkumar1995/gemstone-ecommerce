/**
 * /api/v1/customers
 *   GET  → list all customers
 *   POST → create a customer (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { customerController } from "@/modules/customers";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => customerController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return customerController.create(body);
  });
}
