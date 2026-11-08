/**
 * /api/v1/services/:id  (admin)
 *   GET    → single service
 *   PATCH  → update
 *   DELETE → remove
 * Admin session + services permission required.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { serviceController } from "@/modules/services";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("services:view");
    if (!g.ok) return jsonError(g.error);
    return serviceController.get((await params).id);
  }, request);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("services:edit");
    if (!g.ok) return jsonError(g.error);
    const body = await request.json().catch(() => null);
    return serviceController.update((await params).id, body);
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("services:delete");
    if (!g.ok) return jsonError(g.error);
    return serviceController.remove((await params).id);
  }, request);
}
