/** POST /api/v1/astrologer-auth/logout — goes offline, clears the refresh token and cookies. ?all=1 logs out every device. */
import type { NextRequest } from "next/server";
import { handle, jsonOk } from "@/core/http";
import { verifyAstroToken, ASTRO_ACCESS_COOKIE, ASTRO_REFRESH_COOKIE } from "@/core/astrologer-jwt";
import { astrologerAuthService, clearAstroCookies } from "@/modules/astrologer-auth";
import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const claims = (await verifyAstroToken(request.cookies.get(ASTRO_ACCESS_COOKIE)?.value, "access"))
      ?? (await verifyAstroToken(request.cookies.get(ASTRO_REFRESH_COOKIE)?.value, "refresh"));
    if (claims) {
      await astrologerService.presence(claims.sub, { action: "offline" }).catch(() => {});
      if (request.nextUrl.searchParams.get("all") === "1") await astrologerAuthService.logoutAll(claims.sub);
      else await astrologerAuthService.logout(claims.sub);
    }
    const out = jsonOk({ ok: true });
    clearAstroCookies(out);
    return out;
  }, request);
}