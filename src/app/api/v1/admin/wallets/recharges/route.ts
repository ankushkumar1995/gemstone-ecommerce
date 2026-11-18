/**
 * GET /api/v1/admin/wallets/recharges?status=&q=&from=&to=&cursor=
 *   → every customer's recharges, newest first, with the customer attached.
 *   q = name, phone, email, or a Razorpay order / payment id.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { walletAdminService } from "@/modules/wallets/wallet.admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("wallets:view");
    if (!g.ok) return jsonError(g.error);
    const sp = request.nextUrl.searchParams;
    const v = (k: string, max: number) => sp.get(k)?.slice(0, max) || undefined;
    return jsonOk(await walletAdminService.recharges({ status: v("status", 10), q: v("q", 80), from: v("from", 30), to: v("to", 30), cursor: v("cursor", 40) }));
  }, request);
}
