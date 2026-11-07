/** GET /api/v1/admin/astrologers/:id/kyc-file?type=pan — 5-minute signed URL for a private KYC file (audited). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { AppErrors } from "@/core/errors";
import { auditService } from "@/modules/audit";
import { astrologerService, KYC_DOC_TYPES, type KycDocType } from "@/modules/astrologers";
import { kycFiles } from "@/modules/astrologers/astrologer.files";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    void parse; void body;
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type") as KycDocType;
    if (!KYC_DOC_TYPES.includes(type)) return jsonError(AppErrors.validation("Unknown document type"));
    const a = await astrologerService.getInternal(id);
    const doc = a?.kyc.find((d) => d.type === type);
    if (!a || !doc?.fileKey) return jsonError(AppErrors.notFound("No file uploaded for this document"));
    const res = await kycFiles.signedUrl(a.id, doc.fileKey);
    if (res.ok) await auditService.record({ action: "update", entity: "astrologer", entityId: a.id, entityLabel: a.displayName, summary: "Viewed KYC " + type + " document", actor: g.value.session.user.name });
    return toResponse(res);
  }, request);
}