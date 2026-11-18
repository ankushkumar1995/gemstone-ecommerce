/** GET /api/v1/admin/live?status=live|scheduled|all  (admin) → { lives } */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { liveService } from "@/modules/live";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("consultations:view");
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ lives: await liveService.adminList({ status: request.nextUrl.searchParams.get("status") ?? "all" }) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
