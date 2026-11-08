/** /api/v1/admin/service-categories — GET (with counts) · POST create · PUT { ids } reorder. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { createServiceCategorySchema, reorderServiceCategoriesSchema, serviceCategoryService } from "@/modules/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("services:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await serviceCategoryService.list());
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("services:create");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(createServiceCategorySchema, await request.json().catch(() => null));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await serviceCategoryService.create(parsed.value, g.value.session.user.name), 201);
  }, request);
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("services:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(reorderServiceCategoriesSchema, await request.json().catch(() => null));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await serviceCategoryService.reorder(parsed.value.ids, g.value.session.user.name));
  }, request);
}
