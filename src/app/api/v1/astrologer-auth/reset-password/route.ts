/** POST /api/v1/astrologer-auth/reset-password — single-use token, 1 hour TTL. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse, z } from "@/core/validation";
import { astrologerAuthService } from "@/modules/astrologer-auth";
import { body, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";
const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid link"), newPassword: z.string().min(8).max(72) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = limit(request, "astro:reset", 10, 60 * 60);
    if (rl) return jsonError(rl);
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerAuthService.resetPassword(parsed.value.token, parsed.value.newPassword));
  }, request);
}