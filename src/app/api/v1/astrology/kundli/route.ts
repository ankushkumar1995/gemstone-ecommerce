/**
 * /api/v1/astrology/kundli
 *   POST → generate a free Vedic kundli (birth chart) from birth details.
 *
 * Runs the sidereal (Lahiri) ephemeris on the server so the heavy astronomy
 * code never ships to the browser.
 */

import type { NextRequest } from "next/server";
import { handle, jsonOk, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { resolveBirth } from "@/lib/astrology/birth";
import { computeKundli } from "@/lib/astrology/vedic";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(AppErrors.validation("Invalid request."));
    }

    const { name, date, time, place } = body as Record<string, string>;
    const resolved = resolveBirth({ date, time, place });
    if ("error" in resolved) {
      return jsonError(AppErrors.validation(resolved.error));
    }

    const kundli = computeKundli({
      date: resolved.utc,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    });

    return jsonOk({
      name: (name || "").trim() || "You",
      place: resolved.city.name,
      country: resolved.city.country,
      kundli,
    });
  }, request);
}
