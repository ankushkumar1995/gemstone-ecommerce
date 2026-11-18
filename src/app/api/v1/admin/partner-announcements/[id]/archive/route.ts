/** POST /api/v1/admin/partner-announcements/:id/archive — take it off partner dashboards (astrologers:edit). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { noticeService } from "@/modules/partner-notices";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await noticeService.archive((await params).id, { name: g.value.session.user.name }));
  }, request);
}
