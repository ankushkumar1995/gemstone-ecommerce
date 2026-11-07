/** POST /api/v1/astrologer-auth/forgot-password — always 200 (no account enumeration). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse, z } from "@/core/validation";
import { astrologerAuthService } from "@/modules/astrologer-auth";
import { body, limit } from "@/modules/astrologer-auth/http";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = limit(request, "astro:forgot", 5, 60 * 60);
    if (rl) return jsonError(rl);
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerAuthService.forgotPassword(parsed.value.email));
  }, request);
}