/**
 * GET /api/v1/catalog/services/:slug  (public; app + any API client)
 *   → { service, related }  or 404 when hidden / not shown on the caller's channel.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { catalogService } from "@/modules/catalog";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const rl = rateLimit(`catalog:service:${clientIp(request.headers)}`, { limit: 240, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const { slug } = await params;
    if (!/^[a-z0-9-]{1,90}$/.test(slug)) return jsonError(AppErrors.notFound("Service not found"));
    const r = await catalogService.service(slug, channelOf(request.headers));
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
