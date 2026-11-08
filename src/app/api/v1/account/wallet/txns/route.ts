/**
 * /api/v1/account/wallet/txns?cursor=<id>&type=<txnType>  (customer, guarded)
 *   GET → next page of the signed-in customer's own wallet ledger.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { walletService, WALLET_TXN_TYPES, type WalletTxnType } from "@/modules/wallets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const sp = request.nextUrl.searchParams;
  const cursor = sp.get("cursor")?.slice(0, 40) || undefined;
  const t = sp.get("type");
  const type = t && (WALLET_TXN_TYPES as readonly string[]).includes(t) ? (t as WalletTxnType) : undefined;
  const res = await walletService.history(guard.value.customerId, cursor, type);
  if (!res.ok) return jsonError(res.error);
  return jsonOk(res.value);
}
