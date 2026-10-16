/**
 * /api/v1/coupons/:id/toggle  (admin)
 *   PATCH → enable/disable a coupon. body: { active: boolean }
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { couponController } from "@/modules/coupons";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return couponController.toggle(id, body);
  });
}
