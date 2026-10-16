/**
 * /api/v1/products/:id/variants/:sku  (admin)
 *   PATCH  → update a single variant by SKU (products:edit)
 *   DELETE → remove a single variant by SKU (products:edit)
 *
 * `:sku` is the variant SKU (matched case-insensitively by the service).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

/** Shared write throttle: 30 mutations / minute per IP. */
function throttleWrite(request: NextRequest) {
  const rl = rateLimit(`products:write:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 60 });
  return rl.allowed
    ? null
    : jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sku: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("products:edit");
    if (!guard.ok) return jsonError(guard.error);
    const limited = throttleWrite(request);
    if (limited) return limited;
    await actorFromSession(guard.value.session);
    const { id, sku } = await params;
    const body = await request.json().catch(() => null);
    return productController.updateVariant(id, decodeURIComponent(sku), body);
  }, request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sku: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("products:edit");
    if (!guard.ok) return jsonError(guard.error);
    const limited = throttleWrite(request);
    if (limited) return limited;
    await actorFromSession(guard.value.session);
    const { id, sku } = await params;
    return productController.removeVariant(id, decodeURIComponent(sku));
  }, request);
}
