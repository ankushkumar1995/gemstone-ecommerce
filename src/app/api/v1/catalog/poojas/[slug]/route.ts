/**
 * GET /api/v1/catalog/poojas/:slug  (public; app + any API client)
 *   → { pooja } full detail (packages, add-ons, sankalp form, policy),
 *     or 404 when hidden / not bookable / not shown on the caller's channel.
 * Open dates: GET /api/v1/poojas/:slug/slots. Booking: POST /api/v1/poojas/bookings.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { channelOf } from "@/core/channels";
import { catalogPoojaService } from "@/modules/catalog";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const rl = rateLimit(`catalog:pooja:${clientIp(request.headers)}`, { limit: 240, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const { slug } = await params;
    if (!/^[a-z0-9-]{1,90}$/.test(slug)) return jsonError(AppErrors.notFound("Pooja not found"));
    const r = await catalogPoojaService.detail(slug, channelOf(request.headers));
    if (!r.ok) return jsonError(r.error);
    const res = jsonOk(r.value);
    res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.headers.set("Vary", "X-Client");
    return res;
  }, request);
}
