/**
 * /api/v1/payments/razorpay/webhook  (server-to-server, Razorpay → us)
 *   POST → settle an order from the authoritative gateway event. This is the
 *          safety net: if the shopper closes the tab right after paying (so the
 *          /verify callback never fires), Razorpay still tells us here.
 *
 * SECURITY — verified against RAZORPAY_WEBHOOK_SECRET using the RAW request
 * body (re-stringified JSON would change bytes and break the HMAC). We only act
 * on payment.captured / order.paid events and resolve our order by the gateway
 * order id. markPaid is idempotent, so webhook + browser callback can race
 * without double-committing stock or customer stats.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { orderService } from "@/modules/orders";
import { settlePayment } from "@/modules/orders/order-checkout.service";
import { bookingService } from "@/modules/bookings";
import { walletService } from "@/modules/wallets";
import { poojaPaymentService } from "@/modules/poojas";
import { getPoojaRepository } from "@/modules/poojas/pooja.repository";
import { verifyWebhookSignature } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Read the raw body BEFORE parsing — needed verbatim for the signature.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    return jsonError(AppErrors.unauthorized("Invalid webhook signature"));
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return jsonError(AppErrors.validation("Invalid webhook payload"));
  }

  const e = event as {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } };
      order?: { entity?: { id?: string; amount_paid?: number } };
    };
  };

  // Pull the gateway order id + payment id out of the known event shapes.
  const razorpayOrderId =
    e.payload?.payment?.entity?.order_id ?? e.payload?.order?.entity?.id;
  const razorpayPaymentId = e.payload?.payment?.entity?.id;
  // Amount actually paid (paise), when the event carries it.
  const amountPaise = e.payload?.payment?.entity?.amount ?? e.payload?.order?.entity?.amount_paid;

  const settleEvents = new Set(["payment.captured", "order.paid"]);
  if (!e.event || !settleEvents.has(e.event) || !razorpayOrderId) {
    // Acknowledge non-settlement events so Razorpay doesn't retry.
    return jsonOk({ received: true });
  }

  // A real failure while settling → 500, so Razorpay retries (every path below
  // is idempotent, so a retry can never double-apply).
  const retryLater = (msg: string) => jsonError(AppErrors.internal(msg));

  // The gateway order id belongs to ONE of: product order, service booking,
  // pooja booking, wallet recharge. Settle whichever it maps to.
  const order = await orderService.findByRazorpayOrderId(razorpayOrderId);
  if (order) {
    if (!razorpayPaymentId) return jsonOk({ received: true }); // order.paid without a payment: wait for payment.captured
    // Exact amount, exactly once; a mismatch is recorded for review (200, retrying cannot fix it).
    const r = await settlePayment(razorpayOrderId, razorpayPaymentId, amountPaise);
    return r.ok ? jsonOk({ received: true }) : retryLater("Could not settle the order");
  }

  const booking = await bookingService.findByRazorpayOrderId(razorpayOrderId);
  if (booking) {
    if (!razorpayPaymentId) return jsonOk({ received: true }); // order.paid without a payment: wait for payment.captured
    const r = await bookingService.markPaid(booking.id, { razorpayOrderId, razorpayPaymentId }, { amountPaise });
    // A mismatched amount is recorded for review; retrying would not change it.
    if (!r.ok && !/match/i.test(r.error.message)) return retryLater("Could not settle the booking");
    return jsonOk({ received: true });
  }

  const pooja = await getPoojaRepository().findBookingByRazorpayOrder(razorpayOrderId);
  if (pooja) {
    if (!razorpayPaymentId) return jsonOk({ received: true });
    const r = await poojaPaymentService.settle(razorpayOrderId, razorpayPaymentId, amountPaise);
    return r.ok ? jsonOk({ received: true }) : retryLater("Could not settle the pooja booking");
  }

  // Wallet recharge: credit exactly once (idempotent on the recharge id).
  const recharge = await walletService.rechargeByOrder(razorpayOrderId);
  if (recharge) {
    const res = await walletService.settleRecharge(razorpayOrderId, razorpayPaymentId);
    // A real failure → 500 so Razorpay retries later.
    if (!res.ok) return jsonError(res.error);
  }

  // Unknown reference — still 200 so Razorpay stops retrying.
  return jsonOk({ received: true });
}
