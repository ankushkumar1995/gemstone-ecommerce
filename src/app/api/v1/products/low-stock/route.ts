/**
 * /api/v1/products/low-stock  (admin)
 *   GET → products at/below their own lowStockThreshold (restock report).
 *     ?outOnly=true → only fully out-of-stock products.
 *
 * Guarded with `products:view`. Efficient server-side query (no client-side
 * filtering of the whole catalogue).
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
    return productController.listLowStock(request.nextUrl.searchParams);
  }, request);
}
