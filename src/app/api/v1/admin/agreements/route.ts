/**
 * /api/v1/admin/agreements
 *   GET  → all versions with signing progress (astrologers:view)
 *   POST → new draft, either full content or { cloneFrom, version? } (astrologers:edit)
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { agreementService, createDraftSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await agreementService.list());
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(createDraftSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await agreementService.createDraft(parsed.value, { name: g.value.session.user.name }), 201);
  }, request);
}
