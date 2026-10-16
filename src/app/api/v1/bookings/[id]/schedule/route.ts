/** /api/v1/bookings/:id/schedule — PATCH set the appointment time (admin). */
import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { bookingController } from "@/modules/bookings";
import { requireAdmin } from "@/modules/admin-auth/guard";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("orders:edit");
    if (!admin.ok) return jsonError(admin.error);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return bookingController.schedule(id, body);
  });
}
