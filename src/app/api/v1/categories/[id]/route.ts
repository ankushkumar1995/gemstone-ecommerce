/**
 * /api/v1/categories/:id
 *   GET    → single category
 *   PATCH  → update (admin)
 *   DELETE → remove (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return categoryController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return categoryController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return categoryController.remove(id);
  });
}
