/**
 * /api/v1/admin/agreements/:id/extensions (astrologers:edit)
 *   POST   → { astrologerId, until, reason } give one partner more time
 *   DELETE → ?astrologerId=… remove that extension
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { agreementService, extensionSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(extensionSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await agreementService.extend((await params).id, parsed.value, { name: g.value.session.user.name }));
  }, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const astrologerId = request.nextUrl.searchParams.get("astrologerId")?.trim();
    if (!astrologerId) return jsonError(AppErrors.validation("astrologerId is required"));
    return toResponse(await agreementService.removeExtension((await params).id, astrologerId, { name: g.value.session.user.name }));
  }, request);
}
