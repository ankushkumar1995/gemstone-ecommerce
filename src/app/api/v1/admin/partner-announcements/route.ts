/**
 * /api/v1/admin/partner-announcements
 *   GET  → all announcements with sent / read counts (astrologers:view)
 *   POST → { title, body, audience, pinned } publish to partners (astrologers:edit)
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { noticeService } from "@/modules/partner-notices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await noticeService.listAnnouncements());
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await noticeService.publish(await body(request), { name: g.value.session.user.name }), 201);
  }, request);
}
