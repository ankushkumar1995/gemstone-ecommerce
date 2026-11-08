/** /api/v1/admin/poojas/:id — GET · PUT (full save) · PATCH { status } · DELETE (only without bookings). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse, z } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { POOJA_STATUSES, poojaInputSchema, poojaService } from "@/modules/poojas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await poojaService.get((await params).id));
  }, request);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(poojaInputSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaService.update((await params).id, parsed.value, { name: g.value.session.user.name }));
  }, request);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(z.object({ status: z.enum(POOJA_STATUSES) }), await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaService.setStatus((await params).id, parsed.value.status, { name: g.value.session.user.name }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:delete");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await poojaService.remove((await params).id, { name: g.value.session.user.name }));
  }, request);
}
