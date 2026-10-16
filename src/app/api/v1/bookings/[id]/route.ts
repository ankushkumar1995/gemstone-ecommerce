/**
 * /api/v1/bookings/:id  (admin)
 *   GET    → single booking
 *   DELETE → soft-delete a booking
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { bookingController } from "@/modules/bookings";
import { requireAdmin } from "@/modules/admin-auth/guard";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("orders:view");
    if (!admin.ok) return jsonError(admin.error);
    const { id } = await params;
    return bookingController.get(id);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("orders:edit");
    if (!admin.ok) return jsonError(admin.error);
    const { id } = await params;
    return bookingController.remove(id);
  });
}
