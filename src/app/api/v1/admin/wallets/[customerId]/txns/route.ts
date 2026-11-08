/** GET /api/v1/admin/wallets/:customerId/txns?cursor&type — next ledger page. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { walletService, WALLET_TXN_TYPES, type WalletTxnType } from "@/modules/wallets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("wallets:view");
    if (!g.ok) return jsonError(g.error);
    const sp = request.nextUrl.searchParams;
    const cursor = sp.get("cursor")?.slice(0, 40) || undefined;
    const t = sp.get("type");
    const type = t && (WALLET_TXN_TYPES as readonly string[]).includes(t) ? (t as WalletTxnType) : undefined;
    const res = await walletService.history((await params).customerId, cursor, type);
    if (!res.ok) return jsonError(res.error);
    return jsonOk(res.value);
  }, request);
}
