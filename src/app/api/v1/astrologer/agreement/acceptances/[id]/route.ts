/** GET /api/v1/astrologer/agreement/acceptances/:id — my signed copy (exact text + certificate + verify). */
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { agreementService } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    return toResponse(await agreementService.partnerCopy(g.value.astrologer, (await params).id));
  }, request);
}
