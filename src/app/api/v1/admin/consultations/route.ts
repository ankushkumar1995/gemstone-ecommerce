/** GET /api/v1/admin/consultations?status=live|reported|reviews|all  (admin) → { sessions } */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { consultService, maybeSweepConsultations } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("consultations:view");
  if (!g.ok) return jsonError(g.error);
  maybeSweepConsultations();
  const status = request.nextUrl.searchParams.get("status") ?? "all";
  const out = jsonOk({ sessions: await consultService.adminList({ status, limit: 150 }) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
