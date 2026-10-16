/**
 * /api/v1/bookings
 *   GET  → list all service bookings  (admin only)
 *   POST → create a booking from the storefront  (login required)
 *
 * SECURITY
 *   • GET is admin-only (listing everyone's bookings).
 *   • POST requires a signed-in customer; the customerId is taken from the
 *     session, never the body. The charged amount is the server-side service
 *     price (resolved in the service), so the client can't influence it.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { bookingController } from "@/modules/bookings";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { requireCustomer } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin("orders:view");
    if (!admin.ok) return jsonError(admin.error);
    return bookingController.list();
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireCustomer();
    if (!guard.ok) return jsonError(guard.error);
    const body = await request.json().catch(() => null);
    const safeBody =
      body && typeof body === "object"
        ? { ...(body as Record<string, unknown>), customerId: guard.value.customerId }
        : body;
    return bookingController.create(safeBody);
  });
}
