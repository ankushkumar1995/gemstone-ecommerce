/**
 * /api/v1/payments/razorpay/wallet-verify  (wallet recharge callback)
 *   POST → verify the checkout signature and credit the wallet (exactly once).
 *
 * The recharge must belong to the logged-in customer. settleRecharge is
 * idempotent, so this callback and the webhook can race safely.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { walletService } from "@/modules/wallets";
import { verifyPaymentSignature } from "@/core/razorpay";

export const dynamic = "force-dynamic";

const schema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(100),
  razorpayPaymentId: z.string().trim().min(1).max(100),
  razorpaySignature: z.string().trim().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:wverify:${ip}`, { limit: 30, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Try again shortly."));

  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);

  const parsed = parse(schema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.value;

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    return jsonError(AppErrors.validation("Payment verification failed"));
  }

  const recharge = await walletService.rechargeByOrder(razorpayOrderId);
  if (!recharge || recharge.customerId !== guard.value.customerId) return jsonError(AppErrors.notFound("Recharge not found"));

  const res = await walletService.settleRecharge(razorpayOrderId, razorpayPaymentId);
  if (!res.ok) return jsonError(res.error);

  const b = res.value.balance;
  return jsonOk({
    status: res.value.recharge.status,
    creditedPaise: recharge.amountPaise + recharge.bonusPaise,
    balance: { cashPaise: b.cashPaise, promoPaise: b.promoPaise, totalPaise: b.cashPaise + b.promoPaise },
  });
}
