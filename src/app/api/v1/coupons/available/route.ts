/**
 * /api/v1/coupons/available?subtotal=NNN  (public storefront)
 *   GET → the PUBLIC coupons to show in the checkout "Available offers" list,
 *         each with an eligibility check against the given cart subtotal.
 *
 * Secret/targeted coupons (isPublic=false) are never returned here. The signed-
 * in customer id (if any) is read from the session so per-customer usage limits
 * are reflected in eligibility — it's optional (guests get a generic view).
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { couponController } from "@/modules/coupons";
import { requireCustomer } from "@/modules/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const subtotal = Number(request.nextUrl.searchParams.get("subtotal") ?? "0") || 0;
    const guard = await requireCustomer();
    const customerId = guard.ok ? guard.value.customerId : undefined;
    return couponController.available(subtotal, customerId);
  });
}
