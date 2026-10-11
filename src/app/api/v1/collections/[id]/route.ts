/**
 * /api/v1/collections/:id
 *   GET    → single collection
 *   PATCH  → update (admin)
 *   DELETE → remove (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { collectionController } from "@/modules/collections";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return collectionController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return collectionController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return collectionController.remove(id);
  });
}
