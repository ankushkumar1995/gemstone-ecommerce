/** POST /api/v1/astrologer/kyc — submit a KYC document (number and/or uploaded file key). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, kycSubmitSchema } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(kycSubmitSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    // A file key must belong to this astrologer (prevents attaching someone else's upload).
    if (parsed.value.fileKey && !parsed.value.fileKey.startsWith(`kyc/${g.value.astrologer.id}/`)) {
      return jsonError(AppErrors.forbidden("Invalid file"));
    }
    return toResponse(await astrologerService.submitKyc(g.value.astrologer.id, parsed.value));
  }, request);
}