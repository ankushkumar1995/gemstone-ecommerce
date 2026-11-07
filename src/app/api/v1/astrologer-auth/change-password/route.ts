/** POST /api/v1/astrologer-auth/change-password — signs out other devices; re-issues this device's session. */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk } from "@/core/http";
import { parse, z } from "@/core/validation";
import { astrologerAuthService, requireAstrologer, setAstroCookies } from "@/modules/astrologer-auth";
import { body, fingerprintOf, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";
const schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(72) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer({ allowPasswordChange: true });
    if (!g.ok) return jsonError(g.error);
    const rl = limit(request, `astro:pw:${g.value.astrologer.id}`, 6, 15 * 60);
    if (rl) return jsonError(rl);
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const res = await astrologerAuthService.changePassword(g.value.astrologer.id, parsed.value.currentPassword, parsed.value.newPassword);
    if (!res.ok) return jsonError(res.error);
    const out = jsonOk({ ok: true });
    setAstroCookies(out, await astrologerAuthService.issueFor(g.value.astrologer.id, await fingerprintOf(request)));
    return out;
  }, request);
}