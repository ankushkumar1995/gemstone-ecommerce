/**
 * /api/v1/articles/:id  (admin)
 *   GET    → single article (any status)
 *   PATCH  → update
 *   DELETE → remove
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { articleController } from "@/modules/blog";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return articleController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return articleController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return articleController.remove(id);
  });
}
