/**
 * /api/v1/astrology/cities?q=...
 *   GET → autocomplete suggestions for the birth-place field.
 */

import type { NextRequest } from "next/server";
import { handle, jsonOk } from "@/core/http";
import { searchCities } from "@/lib/astrology/cities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const results = searchCities(q).map((c) => ({
      label: c.state ? `${c.name}, ${c.state}, ${c.country}` : `${c.name}, ${c.country}`,
      value: c.name,
    }));
    return jsonOk(results);
  }, request);
}
