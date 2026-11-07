/** PATCH /api/v1/admin/astrologers/:id/status — { status, reason? } (reason required for reject/suspend). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, statusSchema, type AstrologerStatus } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(statusSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.changeStatus((await params).id, parsed.value.status as AstrologerStatus, parsed.value.reason, { name: g.value.session.user.name, kind: "admin" }));
  }, request);
}