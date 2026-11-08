/** /api/v1/admin/pooja-categories — GET (with pooja counts) · POST create · PUT { keys } reorder. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { categoryCreateSchema, categoryReorderSchema, poojaCategoryService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await poojaCategoryService.list());
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:create");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(categoryCreateSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaCategoryService.create(parsed.value, { name: g.value.session.user.name }), 201);
  }, request);
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(categoryReorderSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaCategoryService.reorder(parsed.value.keys, { name: g.value.session.user.name }));
  }, request);
}
