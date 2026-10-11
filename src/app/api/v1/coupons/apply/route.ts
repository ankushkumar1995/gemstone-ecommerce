/**
 * /api/v1/coupons/apply  (public storefront)
 *   POST → validate a code against a cart subtotal, returns the discount
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { couponController } from "@/modules/coupons";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return couponController.apply(body);
  });
}
