/**
 * /api/v1/products
 *   GET  → list all products (plain) OR paginated+filtered when query params
 *          are present (?page/limit/sort/q/status/categoryId/featured/…).
 *   POST → create a product (admin, rate-limited).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // If the client asks for a page/search/sort/filter, return the paginated
  // envelope; otherwise return the plain list (storefront compatibility).
  const wantsPage =
    sp.has("page") ||
    sp.has("limit") ||
    sp.has("sort") ||
    sp.has("q") ||
    sp.has("status") ||
    sp.has("categoryId") ||
    sp.has("featured") ||
    sp.has("inStock") ||
    sp.has("tag") ||
    sp.has("minPrice") ||
    sp.has("maxPrice");
  if (wantsPage) {
    return handle(() => productController.listPaginated(sp), request);
  }
  return handle(() => productController.list(), request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("products:create");
    if (!guard.ok) return jsonError(guard.error);

    const rl = rateLimit(`products:create:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }

    // Resolve the actor for audit/privilege context (parity with users/categories).
    await actorFromSession(guard.value.session);
    const body = await request.json().catch(() => null);
    return productController.create(body);
  }, request);
}
