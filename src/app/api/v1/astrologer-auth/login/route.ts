/** POST /api/v1/astrologer-auth/login — rate-limited per IP + email; lockout is the deeper layer. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { parse, z } from "@/core/validation";
import { astrologerAuthService, setAstroCookies } from "@/modules/astrologer-auth";
import { body, fingerprintOf, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const rl = limit(request, `astro:login:${parsed.value.email}`, 8, 15 * 60);
    if (rl) return jsonError(rl);
    const res = await astrologerAuthService.login(parsed.value.email, parsed.value.password, await fingerprintOf(request));
    if (!res.ok) return jsonError(res.error);
    const out = jsonOk({ astrologer: res.value.astrologer });
    setAstroCookies(out, res.value.tokens);
    return out;
  }, request);
}