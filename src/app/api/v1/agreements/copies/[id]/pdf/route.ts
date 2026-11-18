/**
 * GET /api/v1/agreements/copies/:id/pdf?t=<token> — signed agreement PDF via the
 * link in the partner's email. No login: the HMAC token (expires) is the key,
 * so suspended or closed accounts can still get their own contract.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { limit } from "@/modules/astrologer-auth/http";
import { agreementService } from "@/modules/agreements";
import { pdfResponse } from "@/modules/agreements/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const rl = limit(request, "agr-copy-link", 30, 10 * 60);
    if (rl) return jsonError(rl);
    const token = request.nextUrl.searchParams.get("t") ?? "";
    if (!token) return jsonError(AppErrors.notFound("Signed copy not found"));
    const r = await agreementService.linkPdf((await params).id, token);
    return r.ok ? pdfResponse(r.value) : jsonError(r.error);
  }, request);
}
