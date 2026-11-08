/**
 * /api/v1/account/wallet  (customer, guarded)
 *   GET → balance (cash + bonus), recharge packs, GST rate, first page of history.
 */

import { jsonError, jsonOk } from "@/core/http";
import { requireCustomer } from "@/modules/customer-auth";
import { walletService } from "@/modules/wallets";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const id = guard.value.customerId;
  const [wallet, history] = await Promise.all([walletService.view(id), walletService.history(id)]);
  if (!history.ok) return jsonError(history.error);
  return jsonOk({ wallet, txns: history.value.items, nextCursor: history.value.nextCursor });
}
