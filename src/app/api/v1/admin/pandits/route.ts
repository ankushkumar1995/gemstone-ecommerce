/** /api/v1/admin/pandits — GET list · POST create. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { panditInputSchema, panditService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await panditService.list());
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:create");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(panditInputSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await panditService.create(parsed.value, { name: g.value.session.user.name }), 201);
  }, request);
}
