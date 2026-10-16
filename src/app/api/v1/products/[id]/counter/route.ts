/**
 * /api/v1/products/:id/counter  (admin)
 *   POST → increment a rollup counter (products:edit)
 *     body: { counter: "view" | "sold", by?: number }
 *
 * This is the internal/guarded counterpart to the public `/view` endpoint.
 * The orders module calls it with { counter: "sold", by } on a confirmed sale;
 * admins can also use it to correct counts. "sold" invalidates the cache and
 * records an audit entry; "view" does not.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("products:edit");
    if (!guard.ok) return jsonError(guard.error);
    const rl = rateLimit(`products:write:${clientIp(request.headers)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    await actorFromSession(guard.value.session);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return productController.incrementCounter(id, body);
  }, request);
}
