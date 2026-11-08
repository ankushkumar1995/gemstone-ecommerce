/**
 * /api/v1/poojas/:slug/slots  (public)
 *   GET → open dates for an active pooja (not past cutoff, not full).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { poojaService } from "@/modules/poojas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const rl = rateLimit(`pooja:slots:${clientIp(request.headers)}`, { limit: 120, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many requests. Please try again in a minute."));
    const { slug } = await params;
    if (!/^[a-z0-9-]{1,90}$/.test(slug)) return jsonError(AppErrors.notFound("Pooja not found"));
    const r = await poojaService.openSlots(slug);
    return r.ok ? jsonOk(r.value) : jsonError(r.error);
  }, request);
}
