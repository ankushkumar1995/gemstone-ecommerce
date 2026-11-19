/**
 * GET /api/v1/admin/remedy-sales?status=&astrologerId=&before=  (admin, payouts:view)
 *   → { rules, stats, items, nextBefore }
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { remedyService } from "@/modules/remedies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("payouts:view");
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const out = jsonOk(await remedyService.adminList({ status: sp.get("status") ?? undefined, astrologerId: sp.get("astrologerId") ?? undefined, before: sp.get("before") ?? undefined }));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
