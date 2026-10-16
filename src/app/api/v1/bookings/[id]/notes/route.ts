/**
 * /api/v1/bookings/:id/notes  (admin)
 *   POST  → append a timeline note
 *   PATCH → save the admin notes field (internal / delivery details)
 */
import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { bookingController } from "@/modules/bookings";
import { requireAdmin } from "@/modules/admin-auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("orders:edit");
    if (!admin.ok) return jsonError(admin.error);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return bookingController.addNote(id, body);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("orders:edit");
    if (!admin.ok) return jsonError(admin.error);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return bookingController.setAdminNotes(id, body);
  });
}
