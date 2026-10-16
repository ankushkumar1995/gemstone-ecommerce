/**
 * /api/v1/products/:id/view  (public — storefront)
 *   POST → increment the product's `viewCount` by 1.
 *
 * Called from the product detail page on load. Intentionally unauthenticated
 * (it is a public engagement signal) but rate-limited per IP to blunt abuse.
 * The increment is atomic (`$inc`) and does NOT invalidate the product cache.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    // Generous per-IP cap: a visitor can legitimately view many products,
    // but this stops a single client from inflating counts in a tight loop.
    const rl = rateLimit(`products:view:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    const { id } = await params;
    return productController.incrementCounter(id, { counter: "view", by: 1 });
  }, request);
}
