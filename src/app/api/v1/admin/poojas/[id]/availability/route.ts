/** GET /api/v1/admin/poojas/:id/availability?from=YYYY-MM-DD&days=30 — slots with live capacity. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { isDate, poojaService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    const sp = request.nextUrl.searchParams;
    const from = sp.get("from");
    const days = Number(sp.get("days") ?? 30);
    return toResponse(await poojaService.availability((await params).id, from && isDate(from) ? from : undefined, Number.isFinite(days) ? days : 30));
  }, request);
}
