/**
 * /api/v1/orders
 *   GET  → list all orders  (admin only)
 *   POST → place an order.
 *          • Admin session: the admin "Create order" screen (full control).
 *          • Customer session: the website checkout (Cash on Delivery). Goes
 *            through the customer checkout service: prices, discount,
 *            shipping, tax and status come from the SERVER only, and stock is
 *            reserved atomically. Whatever the browser sends for those is ignored.
 *
 * The customerId always comes from the session, never from the body.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { AppErrors } from "@/core/errors";
import { channelOf } from "@/core/channels";
import { createOrderSchema, orderController } from "@/modules/orders";
import { placeOrder } from "@/modules/orders/order-checkout.service";
import { websitePlaceInput } from "@/modules/orders/checkout.web";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { requireCustomer } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    // Listing every order is an admin-only operation.
    const admin = await requireAdmin("orders:view");
    if (!admin.ok) return jsonError(admin.error);
    return orderController.list();
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);

    // Signed-in customer → hardened checkout.
    const guard = await requireCustomer();
    if (guard.ok) {
      const rl = rateLimit(`orders:place:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 10 * 60 });
      if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please try again in a few minutes."));
      const parsed = parse(createOrderSchema, body);
      if (!parsed.ok) return jsonError(parsed.error);
      const input = websitePlaceInput(parsed.value, "cod", (body as { requestId?: unknown } | null)?.requestId);
      const res = await placeOrder(guard.value.customerId, input, channelOf(request.headers));
      if (!res.ok) return jsonError(res.error);
      return jsonOk(res.value, 201);
    }

    // Admin "Create order" (phone / offline orders).
    const admin = await requireAdmin("orders:create");
    if (admin.ok) return orderController.create(body);
    return jsonError(guard.error);
  });
}
