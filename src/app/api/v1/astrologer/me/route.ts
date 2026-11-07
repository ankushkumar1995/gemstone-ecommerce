/** GET /api/v1/astrologer/me — the signed-in partner's own account (no admin-only fields). */
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    return toResponse(await astrologerService.getSelf(g.value.astrologer.id));
  }, request);
}