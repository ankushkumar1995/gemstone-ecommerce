/**
 * /api/v1/products/:id
 *   GET    → single product
 *   PATCH  → update (admin)
 *   DELETE → remove (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return productController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return productController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return productController.remove(id);
  });
}
