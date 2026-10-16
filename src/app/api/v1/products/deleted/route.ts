/**
 * /api/v1/products/deleted  (admin)
 *   GET → list soft-deleted products for the trash / restore view.
 *
 * Guarded with `products:view`. Separate from the public list endpoint so the
 * storefront never sees deleted products.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("products:view");
    if (!guard.ok) return jsonError(guard.error);
    return productController.listDeleted();
  }, request);
}
