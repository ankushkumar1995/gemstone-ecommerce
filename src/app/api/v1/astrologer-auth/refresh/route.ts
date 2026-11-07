/** POST /api/v1/astrologer-auth/refresh — rotate the refresh token, mint a new access token. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { ASTRO_REFRESH_COOKIE } from "@/core/astrologer-jwt";
import { astrologerAuthService, setAstroCookies, clearAstroCookies } from "@/modules/astrologer-auth";
import { fingerprintOf, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = limit(request, "astro:refresh", 60, 15 * 60);
    if (rl) return jsonError(rl);
    const res = await astrologerAuthService.refresh(request.cookies.get(ASTRO_REFRESH_COOKIE)?.value, await fingerprintOf(request));
    if (!res.ok) {
      const out = jsonError(res.error);
      clearAstroCookies(out);
      return out;
    }
    const out = jsonOk({ astrologer: res.value.astrologer });
    setAstroCookies(out, res.value.tokens);
    return out;
  }, request);
}