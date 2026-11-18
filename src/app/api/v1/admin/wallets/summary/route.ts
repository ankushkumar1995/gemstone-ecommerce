/** GET /api/v1/admin/wallets/summary → paid recharge totals (today / 7 / 30 days), balances held, unpaid count. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { walletAdminService } from "@/modules/wallets/wallet.admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const g = await requireAdmin("wallets:view");
    if (!g.ok) return jsonError(g.error);
    return jsonOk(await walletAdminService.summary());
  }, request);
}
