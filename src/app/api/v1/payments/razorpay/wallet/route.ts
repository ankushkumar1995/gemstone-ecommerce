/**
 * /api/v1/payments/razorpay/wallet  (customer wallet recharge)
 *   POST { packAmount } | { customAmount } → create a recharge + Razorpay order.
 *
 * SECURITY
 *   • Login required; customerId comes from the session only.
 *   • The amount, bonus and GST are priced on the server from the program
 *     settings. The client only says WHICH pack (or a whole-rupee custom amount).
 *   • Money is credited only after signature verification (/wallet-verify) or
 *     the signed webhook. Both paths are idempotent.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { walletService } from "@/modules/wallets";
import { razorpayConfigured, razorpayKeyId, createRazorpayOrder } from "@/core/razorpay";

export const dynamic = "force-dynamic";

const schema = z
  .object({
    packAmount: z.number().int().positive().optional(),
    customAmount: z.number().int().positive().optional(),
  })
  .refine((v) => (v.packAmount === undefined) !== (v.customAmount === undefined), { message: "Choose a pack or enter an amount" });

export async function POST(request: NextRequest) {
  if (!razorpayConfigured()) return jsonError(AppErrors.validation("Online payments are not available right now."));

  const ip = clientIp(request.headers);
  const rl = rateLimit(`pay:rzp:wallet:${ip}`, { limit: 20, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));

  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const customerId = guard.value.customerId;

  const perUser = rateLimit(`pay:rzp:wallet:c:${customerId}`, { limit: 15, windowSeconds: 10 * 60 });
  if (!perUser.allowed) return jsonError(AppErrors.rateLimited("Too many recharge attempts. Try again shortly."));

  const parsed = parse(schema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);

  const q = await walletService.quote(parsed.value);
  if (!q.ok) return jsonError(q.error);

  const recharge = await walletService.createRecharge(customerId, q.value);
  let rzpOrder;
  try {
    rzpOrder = await createRazorpayOrder({
      amountInRupees: q.value.payablePaise / 100,
      receipt: `wrc_${recharge.id}`.slice(0, 40),
      notes: { walletRechargeId: recharge.id, customerId },
    });
  } catch (e) {
    return jsonError(AppErrors.internal(e instanceof Error ? e.message : "Payment init failed"));
  }
  await walletService.attachOrder(recharge.id, rzpOrder.id);

  return jsonOk({
    rechargeId: recharge.id,
    amountPaise: q.value.amountPaise,
    bonusPaise: q.value.bonusPaise,
    gstPaise: q.value.gstPaise,
    amount: rzpOrder.amount, // paise, what Razorpay charges
    currency: rzpOrder.currency,
    razorpayOrderId: rzpOrder.id,
    keyId: razorpayKeyId(),
  });
}
