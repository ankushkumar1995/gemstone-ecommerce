/**
 * /api/v1/admin/pooja-categories/:key
 *   PATCH  update (name, slug, icon, image, description, SEO, visible)
 *   DELETE only when no pooja uses it
 *   POST   { into } merge: move its poojas into another category, then delete it
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { categoryMergeSchema, categoryUpdateSchema, poojaCategoryService } from "@/modules/poojas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(categoryUpdateSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaCategoryService.update((await params).key, parsed.value, { name: g.value.session.user.name }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:delete");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await poojaCategoryService.remove((await params).key, { name: g.value.session.user.name }));
  }, request);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:delete");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(categoryMergeSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaCategoryService.merge((await params).key, parsed.value.into, { name: g.value.session.user.name }));
  }, request);
}
