/** PATCH /api/v1/admin/astrologers/:id/kyc — { type, status: verified|rejected, note? }. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, kycReviewSchema, type KycDocType } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(kycReviewSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.reviewKyc((await params).id, parsed.value.type as KycDocType, parsed.value.status, parsed.value.note, { name: g.value.session.user.name, kind: "admin" }));
  }, request);
}