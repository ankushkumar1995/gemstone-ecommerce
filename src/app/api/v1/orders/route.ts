/**
 * /api/v1/orders
 *   GET  → list all orders  (admin only)
 *   POST → place an order from the storefront checkout.
 *
 * SECURITY
 *   • LOGIN REQUIRED — checkout is for signed-in customers only. A valid
 *     customer session is mandatory; guest/anonymous orders are rejected
 *     (401). This is enforced here on the server, not just hidden in the UI.
 *   • The order's customerId is taken from the session cookie, never from the
 *     request body, so an order can't be attached to another account.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { orderController } from "@/modules/orders";
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
    // Must be a signed-in customer — no guest checkout.
    const guard = await requireCustomer();
    if (!guard.ok) return jsonError(guard.error);

    const body = await request.json().catch(() => null);
    // Force the trusted customer id from the session; ignore any body value.
    const safeBody =
      body && typeof body === "object"
        ? { ...(body as Record<string, unknown>), customerId: guard.value.customerId }
        : body;

    return orderController.create(safeBody);
  });
}
