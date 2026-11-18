/** GET /api/v1/astrologer/notifications/count — unread count for the header bell (cheap, polled). */
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { noticeService } from "@/modules/partner-notices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    return jsonOk({ unread: await noticeService.unreadCount(g.value.astrologer.id) });
  }, request);
}
