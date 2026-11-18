/**
 * /api/v1/admin/agreements/:id
 *   GET    → one version (astrologers:view)
 *   PATCH  → edit a draft (astrologers:edit); published versions are immutable
 *   DELETE → delete a draft (astrologers:edit)
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { agreementService, draftUpdateSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await agreementService.get((await params).id));
  }, request);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(draftUpdateSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await agreementService.updateDraft((await params).id, parsed.value, { name: g.value.session.user.name }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await agreementService.deleteDraft((await params).id, { name: g.value.session.user.name }));
  }, request);
}
