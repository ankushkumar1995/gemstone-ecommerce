/**
 * /api/v1/reviews/:id  (admin)
 *   GET    → single review
 *   PATCH  → moderate (status) / reply
 *   DELETE → remove
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { reviewController } from "@/modules/reviews";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return reviewController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return reviewController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return reviewController.remove(id);
  });
}
