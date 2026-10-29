/**
 * /api/v1/popups/:id  (admin)
 *   GET    → single popup
 *   PATCH  → update
 *   DELETE → remove (soft)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { popupController } from "@/modules/popups";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    return popupController.get(id);
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return popupController.update(id, body);
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    return popupController.remove(id);
  });
}
