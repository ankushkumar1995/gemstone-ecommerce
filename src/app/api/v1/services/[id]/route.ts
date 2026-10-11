/**
 * /api/v1/services/:id  (admin)
 *   GET    → single service
 *   PATCH  → update
 *   DELETE → remove
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { serviceController } from "@/modules/services";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return serviceController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return serviceController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return serviceController.remove(id);
  });
}
