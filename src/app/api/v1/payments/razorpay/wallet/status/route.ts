/**
 * GET /api/v1/payments/razorpay/wallet/status?orderId=order_xxx  (customer, guarded)
 *   → { state, creditedPaise, payablePaise, balance, reason? }
 *
 * The app calls this after checkout, when it comes back from a UPI app, and
 * after a restart for any recharge it left unfinished. If our record is not
 * paid yet it reconciles with Razorpay, so a lost callback AND a missed
 * webhook still end with the wallet credited exactly once.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { walletService } from "@/modules/wallets";
import { fetchOrderPayments, razorpayConfigured } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  // Polled every few seconds while confirming; generous but bounded.
  const rl = rateLimit(`pay:rzp:wstatus:${guard.value.customerId}`, { limit: 90, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Checking too often. Please wait a moment."));

  const orderId = request.nextUrl.searchParams.get("orderId") ?? "";
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(orderId)) return jsonError(AppErrors.validation("Invalid order id"));
  if (!razorpayConfigured()) return jsonError(AppErrors.validation("Online payments are not available right now."));

  const res = await walletService.rechargeStatus(guard.value.customerId, orderId, fetchOrderPayments);
  if (!res.ok) return jsonError(res.error);
  const out = jsonOk(res.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
