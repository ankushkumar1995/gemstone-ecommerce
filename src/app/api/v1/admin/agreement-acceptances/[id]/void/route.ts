/** POST /api/v1/admin/agreement-acceptances/:id/void — { reason } (astrologers:edit). The record is kept, marked void. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { agreementService, voidSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(voidSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await agreementService.voidAcceptance((await params).id, parsed.value.reason, { name: g.value.session.user.name }));
  }, request);
}
