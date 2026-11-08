/** /api/v1/admin/pooja-bookings — GET list (?status=a,b&poojaId&panditId&from&to&q) · POST admin booking. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { adminBookingSchema, bookingListQuery, poojaBookingService } from "@/modules/poojas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    const sp = request.nextUrl.searchParams;
    const raw = {
      status: sp.get("status") ? sp.get("status")!.split(",").filter(Boolean) : undefined,
      poojaId: sp.get("poojaId") || undefined, panditId: sp.get("panditId") || undefined,
      from: sp.get("from") || undefined, to: sp.get("to") || undefined, q: sp.get("q") || undefined,
    };
    const parsed = parse(bookingListQuery, raw);
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaBookingService.list({ ...parsed.value, limit: 500 }));
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("poojas:create");
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(adminBookingSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await poojaBookingService.createByAdmin(parsed.value, { name: g.value.session.user.name }), 201);
  }, request);
}
