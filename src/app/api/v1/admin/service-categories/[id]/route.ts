/**
 * /api/v1/admin/service-categories/:id
 *   PATCH  update (name, slug, icon, description, visible)
 *   DELETE { moveTo?: id | null } — services move to another category or to
 *          Uncategorised; required when the category still has services
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { deleteServiceCategorySchema, serviceCategoryService, updateServiceCategorySchema } from "@/modules/services";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("services:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(updateServiceCategorySchema, await request.json().catch(() => null));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await serviceCategoryService.update((await params).id, parsed.value, g.value.session.user.name));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("services:delete");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(deleteServiceCategorySchema, (await request.json().catch(() => null)) ?? {});
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await serviceCategoryService.remove((await params).id, parsed.value.moveTo, g.value.session.user.name));
  }, request);
}
