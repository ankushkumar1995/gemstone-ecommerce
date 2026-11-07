/** /api/v1/admin/astrologers/:id — GET detail · PATCH admin edit · DELETE (soft) remove. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, adminUpdateSchema } from "@/modules/astrologers";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await astrologerService.getAdmin((await params).id));
  }, request);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(adminUpdateSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.adminUpdate((await params).id, parsed.value, { name: g.value.session.user.name, kind: "admin" }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:delete");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await astrologerService.remove((await params).id, { name: g.value.session.user.name, kind: "admin" }));
  }, request);
}