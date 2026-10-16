/**
 * /api/v1/products/:id/variants  (admin)
 *   POST → add a single variant to the product's variant matrix (products:edit)
 *     body: { sku?, optionValues?, price?, mrp?, stockQty?, weightGram?,
 *             barcode?, image?, isDefault?, active? }
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
    const rl = rateLimit(`products:write:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    await actorFromSession(guard.value.session);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return productController.addVariant(id, body);
  }, request);
}
