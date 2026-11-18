/**
 * GET /api/v1/admin/wallets/transactions?type=&q=&from=&to=&cursor=
 *   → the ledger across all customers, newest first, with the customer attached.
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
    return jsonOk(await walletAdminService.txns({ type: v("type", 20), q: v("q", 80), from: v("from", 30), to: v("to", 30), cursor: v("cursor", 40) }));
  }, request);
}
