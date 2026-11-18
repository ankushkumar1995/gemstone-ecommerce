/**
 * POST /api/v1/admin/wallets/recharges/:orderId/reconcile
 *   Ask Razorpay about this recharge. If it was captured for the exact amount,
 *   the wallet is credited (exactly once, same path as the app and webhook).
 *   Needs wallets:edit because it can move money. Audited.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { auditService } from "@/modules/audit";
import { walletAdminService } from "@/modules/wallets/wallet.admin";
import { razorpayConfigured } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("wallets:edit");
    if (!g.ok) return jsonError(g.error);
    const rl = rateLimit(`admin:wallet-reconcile:${g.value.session.user.id}`, { limit: 60, windowSeconds: 10 * 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many checks. Try again shortly."));
    if (!razorpayConfigured()) return jsonError(AppErrors.validation("Razorpay is not configured."));
    const { orderId } = await params;
    if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return jsonError(AppErrors.validation("Invalid order id"));
    const r = await walletAdminService.reconcile(orderId);
    if (!r.ok) return jsonError(r.error);
    await auditService.record({
      action: "payment", entity: "wallet", entityId: r.value.rechargeId, entityLabel: orderId,
      summary: `Checked recharge ${orderId} with Razorpay: ${r.value.state}${r.value.justCredited ? " (wallet credited now)" : ""}`,
      actor: g.value.session.user.name,
    }).catch(() => undefined);
    return jsonOk(r.value);
  }, request);
}
