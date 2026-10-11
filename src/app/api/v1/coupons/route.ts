/**
 * /api/v1/coupons  (admin)
 *   GET  → list all coupons
 *   POST → create a coupon
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { couponController } from "@/modules/coupons";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => couponController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return couponController.create(body);
  });
}
