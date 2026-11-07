/**
 * POST /api/v1/astrologer/kyc/upload — multipart upload of one KYC file
 * (fields: type, file). Stored privately under kyc/<astrologerId>/.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { limit } from "@/modules/astrologer-auth/http";
import { KYC_DOC_TYPES, type KycDocType } from "@/modules/astrologers";
import { kycFiles } from "@/modules/astrologers/astrologer.files";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const rl = limit(request, `astro:kyc-upload:${g.value.astrologer.id}`, 20, 60 * 60);
    if (rl) return jsonError(rl);
    const form = await request.formData().catch(() => null);
    const type = form?.get("type");
    const file = form?.get("file");
    if (typeof type !== "string" || !KYC_DOC_TYPES.includes(type as KycDocType)) return jsonError(AppErrors.validation("Choose a document type"));
    if (!(file instanceof File)) return jsonError(AppErrors.validation("Attach a file"));
    const bytes = new Uint8Array(await file.arrayBuffer());
    return toResponse(await kycFiles.upload(g.value.astrologer.id, type as KycDocType, file.name, file.type, bytes), 201);
  }, request);
}