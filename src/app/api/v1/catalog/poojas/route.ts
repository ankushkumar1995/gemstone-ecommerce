/**
 * GET /api/v1/catalog/poojas?type=pooja|havan  (public; app + any API client)
 *   → { poojas, categories } bookable and visible on the caller's channel.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { catalogPoojaService } from "@/modules/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`catalog:poojas:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const type = request.nextUrl.searchParams.get("type") === "havan" ? "havan" : "pooja";
    const r = await catalogPoojaService.list(type, channelOf(request.headers));
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    // Short cache: "next open date" changes as slots fill up.
    res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
