/** GET /api/v1/astrologer/agreement/acceptances/:id/pdf — my signed agreement as a PDF file. */
import { handle, jsonError } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { agreementService } from "@/modules/agreements";
import { pdfResponse } from "@/modules/agreements/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    // A partner who still has to change a temporary password may still download their contract.
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    const r = await agreementService.partnerPdf(g.value.astrologer, (await params).id);
    return r.ok ? pdfResponse(r.value) : jsonError(r.error);
  }, request);
}
