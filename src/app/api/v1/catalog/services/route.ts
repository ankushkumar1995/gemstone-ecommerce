/**
 * GET /api/v1/catalog/services  (public; app + any API client)
 *   → { services, categories } visible on the caller's channel.
 * Channel comes from X-Client (android|ios → app, else web). Responses differ
 * per channel, so caches must key on X-Client (Vary).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { catalogService } from "@/modules/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`catalog:services:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const r = await catalogService.services(channelOf(request.headers));
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    res.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
