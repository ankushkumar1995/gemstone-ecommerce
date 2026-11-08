/** GET /api/v1/admin/pooja-bookings/counts — work-queue counters (sidebar badge, dashboard). */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { poojaBookingService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await poojaBookingService.counts());
  }, request);
}
