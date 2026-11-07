/** POST /api/v1/astrologer-auth/apply — public partner signup (rate-limited). Signs the new partner in. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { applySchema, astrologerService } from "@/modules/astrologers";
import { astrologerAuthService, setAstroCookies } from "@/modules/astrologer-auth";
import { body, fingerprintOf, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = limit(request, "astro:apply", 5, 60 * 60);
    if (rl) return jsonError(rl);
    const parsed = parse(applySchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const res = await astrologerService.apply(parsed.value);
    if (!res.ok) return jsonError(res.error);
    const tokens = await astrologerAuthService.issueFor(res.value.id, await fingerprintOf(request));
    const out = jsonOk({ id: res.value.id, status: res.value.status }, 201);
    setAstroCookies(out, tokens);
    return out;
  }, request);
}