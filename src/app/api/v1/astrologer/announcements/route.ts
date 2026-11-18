/** GET /api/v1/astrologer/announcements — live admin announcements for this partner (dashboard). */
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { noticeService } from "@/modules/partner-notices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await noticeService.activeFor(g.value.astrologer.status));
  }, request);
}
