/**
 * /api/v1/products/:id/duplicate  (admin)
 *   POST → clone a product into a fresh draft (new slug + SKU).
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
    const guard = await requireAdmin("products:create");
    if (!guard.ok) return jsonError(guard.error);
    const rl = rateLimit(`products:write:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    await actorFromSession(guard.value.session);
    const { id } = await params;
    return productController.duplicate(id);
  }, request);
}
