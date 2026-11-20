/**
 * POST /api/v1/internal/payments/sweep  (scheduled job, server to server)
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Releases seats of expired pay-online pooja holds (after asking Razorpay)
 *   and settles any that were actually paid. Also chats, lives, the earnings ledger,
 *   weekly payouts, referral bonuses and remedy commissions. Run every 5 minutes.
 * Disabled (404) when CRON_SECRET is not set.
 */
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { env } from "@/core/config/env";
import { fetchOrderPayments, razorpayConfigured } from "@/core/razorpay";
import { poojaPaymentService } from "@/modules/poojas";
import { sweepExpiredOrderHolds } from "@/modules/orders/order-checkout.service";
import { sweepConsultations } from "@/modules/consultations";
import { sweepLives } from "@/modules/live";
import { earningsService } from "@/modules/earnings";
import { referralService } from "@/modules/referrals";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!env.CRON_SECRET) return jsonError(AppErrors.notFound("Not found"));
  if (!authorized(request)) return jsonError(AppErrors.unauthorized("Unauthorized"));
  // Remedy commissions only read orders / bookings, so they run without Razorpay too.
  const { remedyService } = await import("@/modules/remedies");
  const remedies = await remedyService.sweep().catch(() => null);
  // Push: send what is due, check receipts, and watch order / booking statuses.
  const { pushService } = await import("@/modules/push");
  const push = await pushService.sweep().catch(() => null);
  if (!razorpayConfigured()) return jsonOk({ skipped: "razorpay not configured", remedies, push });
  const pooja = await poojaPaymentService.sweepExpiredHolds(fetchOrderPayments);
  const orders = await sweepExpiredOrderHolds(fetchOrderPayments);
  const consultations = await sweepConsultations().catch(() => ({ checked: -1 }));
  const lives = await sweepLives().catch(() => ({ checked: -1 }));
  const ledger = await earningsService.reconcile().catch(() => null);
  const weeklyPayouts = await earningsService.runWeekly(false).catch(() => null);
  const referrals = await referralService.sweep().catch(() => null);
  return jsonOk({ pooja, orders, consultations, lives, ledger, weeklyPayouts, referrals, remedies, push });
}
