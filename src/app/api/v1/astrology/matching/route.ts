/**
 * /api/v1/astrology/matching
 *   POST → Kundli Matching (Ashtakoot Gun Milan) for a bride + groom.
 *
 * Computes each partner's Moon nakshatra & rashi from their birth details,
 * then runs the 36-guna Ashtakoot compatibility analysis.
 */

import type { NextRequest } from "next/server";
import { handle, jsonOk, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { resolveBirth, type RawBirth } from "@/lib/astrology/birth";
import { computeKundli } from "@/lib/astrology/vedic";
import { computeGunMilan } from "@/lib/astrology/gun-milan";

export const dynamic = "force-dynamic";

interface MatchBody {
  boy: { name?: string } & RawBirth;
  girl: { name?: string } & RawBirth;
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = (await request.json().catch(() => null)) as MatchBody | null;
    if (!body?.boy || !body?.girl) {
      return jsonError(AppErrors.validation("Both partners' details are required."));
    }

    const rb = resolveBirth(body.boy);
    if ("error" in rb) return jsonError(AppErrors.validation(`Groom: ${rb.error}`));
    const rg = resolveBirth(body.girl);
    if ("error" in rg) return jsonError(AppErrors.validation(`Bride: ${rg.error}`));

    const kb = computeKundli({ date: rb.utc, latitude: rb.latitude, longitude: rb.longitude });
    const kg = computeKundli({ date: rg.utc, latitude: rg.latitude, longitude: rg.longitude });

    const result = computeGunMilan(
      { nakshatraIndex: kb.nakshatra.index, rashiIndex: kb.moonSign.rashiIndex },
      { nakshatraIndex: kg.nakshatra.index, rashiIndex: kg.moonSign.rashiIndex },
    );

    return jsonOk({
      boy: {
        name: (body.boy.name || "").trim() || "Groom",
        moonSign: kb.moonSign.rashi,
        nakshatra: kb.nakshatra.name,
        place: rb.city.name,
      },
      girl: {
        name: (body.girl.name || "").trim() || "Bride",
        moonSign: kg.moonSign.rashi,
        nakshatra: kg.nakshatra.name,
        place: rg.city.name,
      },
      result,
    });
  }, request);
}
