/** GET /api/v1/admin/astrologers/counts — badges for the sidebar and dashboard. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";

import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    void parse; void body;
    return toResponse(await astrologerService.counts());
  }, request);
}