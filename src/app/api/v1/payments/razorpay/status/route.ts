/**
 * /api/v1/payments/razorpay/status  (public)
 *   GET → whether online payment is available. Exposes ONLY the publishable
 *          key id (never the secret), so the storefront can decide whether to
 *          offer the "Pay Online" option.
 */

import { jsonOk } from "@/core/http";
import { razorpayConfigured, razorpayKeyId } from "@/core/razorpay";

export const dynamic = "force-dynamic";

export async function GET() {
  const online = razorpayConfigured();
  return jsonOk({ online, keyId: online ? razorpayKeyId() : undefined });
}
