/**
 * POST /api/v1/checkout/quote  (app; sign-in optional)
 *   { items: [{ productId, variantId?, qty, config? }], couponCode? }
 *   → { quote } server prices for every line (configurator included), stock
 *     problems per line, coupon result, shipping, tax, total, COD availability.
 * The same function prices the real order, so the cart can never disagree
 * with what is charged.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { requireCustomer } from "@/modules/customer-auth";
import { quoteSchema } from "@/modules/orders/checkout.schema";
import { quote } from "@/modules/orders/order-checkout.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`checkout:quote:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please wait a moment."));
  const parsed = parse(quoteSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const guard = await requireCustomer();
  const r = await quote(parsed.value.items, { couponCode: parsed.value.couponCode || undefined, customerId: guard.ok ? guard.value.customerId : undefined, channel: channelOf(request.headers) });
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk({ quote: r.value });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
