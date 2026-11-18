/**
 * GET /api/v1/catalog/products/:slug  (public; slug or id)
 *   → { product } with variants, the resolved configurator (energization,
 *     mantra jaap, ring / pendant), certificate and related products.
 * 404 when the product is hidden or not on the caller's channel.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { catalogProducts } from "@/modules/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const rl = rateLimit(`catalog:product:${clientIp(request.headers)}`, { limit: 240, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const { slug } = await params;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(slug)) return jsonError(AppErrors.notFound("This product is not available"));
    const r = await catalogProducts.detail(slug, channelOf(request.headers));
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
