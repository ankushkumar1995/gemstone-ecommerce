/** GET /api/v1/admin/agreement-acceptances/:id/pdf — signed agreement PDF (astrologers:view). */
import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { agreementService } from "@/modules/agreements";
import { pdfResponse } from "@/modules/agreements/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    const r = await agreementService.adminPdf((await params).id);
    return r.ok ? pdfResponse(r.value) : jsonError(r.error);
  }, request);
}
