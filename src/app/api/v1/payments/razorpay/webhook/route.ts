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
import { bookingService } from "@/modules/bookings";
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
      payment?: { entity?: { id?: string; order_id?: string } };
      order?: { entity?: { id?: string } };
    };
  };

  // Pull the gateway order id + payment id out of the known event shapes.
  const razorpayOrderId =
    e.payload?.payment?.entity?.order_id ?? e.payload?.order?.entity?.id;
  const razorpayPaymentId = e.payload?.payment?.entity?.id;

  const settleEvents = new Set(["payment.captured", "order.paid"]);
  if (!e.event || !settleEvents.has(e.event) || !razorpayOrderId) {
    // Acknowledge non-settlement events so Razorpay doesn't retry.
    return jsonOk({ received: true });
  }

  // The gateway order id belongs to EITHER a product order or a service
  // booking — settle whichever it maps to (markPaid is idempotent on both).
  const order = await orderService.findByRazorpayOrderId(razorpayOrderId);
  if (order) {
    await orderService.markPaid(order.id, {
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId ?? "webhook",
    });
    return jsonOk({ received: true });
  }

  const booking = await bookingService.findByRazorpayOrderId(razorpayOrderId);
  if (booking) {
    await bookingService.markPaid(booking.id, {
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId ?? "webhook",
    });
  }

  // Unknown reference — still 200 so Razorpay stops retrying.
  return jsonOk({ received: true });
}
