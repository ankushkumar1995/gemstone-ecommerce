/** GET /api/v1/admin/referrals?status=&q=<code>&before=  (admin, wallets:view) → { items, stats, nextBefore } */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { referralService } from "@/modules/referrals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("wallets:view");
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const out = jsonOk(await referralService.adminList({ status: sp.get("status") ?? undefined, q: sp.get("q") ?? undefined, before: sp.get("before") ?? undefined }));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
