/**
 * /api/v1/customers/:id
 *   GET    → single customer
 *   PATCH  → update (admin)
 *   DELETE → remove (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { customerController } from "@/modules/customers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return customerController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return customerController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return customerController.remove(id);
  });
}
