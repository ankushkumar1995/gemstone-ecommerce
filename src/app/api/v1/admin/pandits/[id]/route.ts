/** /api/v1/admin/pandits/:id — PUT update · DELETE (blocked while they have upcoming poojas). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { panditInputSchema, panditService } from "@/modules/poojas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(panditInputSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await panditService.update((await params).id, parsed.value, { name: g.value.session.user.name }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:delete");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await panditService.remove((await params).id, { name: g.value.session.user.name }));
  }, request);
}
