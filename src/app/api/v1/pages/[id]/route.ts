/**
 * /api/v1/pages/:id  (admin)
 *   GET    → single page
 *   PATCH  → update
 *   DELETE → remove
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { pageController } from "@/modules/pages";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return pageController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return pageController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return pageController.remove(id);
  });
}
