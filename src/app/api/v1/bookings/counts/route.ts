/**
 * /api/v1/bookings/counts  (admin)
 *   GET → lightweight booking counts for the admin badge + dashboard widget.
 */

import { handle, jsonError } from "@/core/http";
import { bookingController } from "@/modules/bookings";
import { requireAdmin } from "@/modules/admin-auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin("orders:view");
    if (!admin.ok) return jsonError(admin.error);
    return bookingController.counts();
  });
}
