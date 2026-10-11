/**
 * /api/v1/banners/:id  (admin)
 *   GET    → single banner
 *   PATCH  → update
 *   DELETE → remove
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { bannerController } from "@/modules/banners";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return bannerController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return bannerController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return bannerController.remove(id);
  });
}
