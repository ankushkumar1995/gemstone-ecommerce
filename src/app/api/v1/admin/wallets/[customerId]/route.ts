/** GET /api/v1/admin/wallets/:customerId — balance, recent recharges and first ledger page. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { customerService } from "@/modules/customers";
import { walletService } from "@/modules/wallets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("wallets:view");
    if (!g.ok) return jsonError(g.error);
    const { customerId } = await params;
    const c = await customerService.getById(customerId);
    if (!c.ok) return jsonError(c.error);
    const [wallet, history, recharges] = await Promise.all([
      walletService.view(customerId),
      walletService.history(customerId),
      walletService.recharges(customerId),
    ]);
    if (!history.ok) return jsonError(history.error);
    return jsonOk({ wallet, txns: history.value.items, nextCursor: history.value.nextCursor, recharges });
  }, request);
}
