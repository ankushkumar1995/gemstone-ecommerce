/**
 * POST /api/v1/astrologer/agreement/sign — verify the OTP and record the signature.
 * Body: OTP request fields + { challengeId, code, secondsOnPage }.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { clientIp } from "@/core/rate-limit";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body, limit } from "@/modules/astrologer-auth/http";
import { agreementService, signSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = limit(request, "agr-sign", 20, 10 * 60);
    if (rl) return jsonError(rl);
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(signSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const ctx = { ip: clientIp(request.headers), userAgent: request.headers.get("user-agent") ?? "" };
    return toResponse(await agreementService.sign(g.value.astrologer, parsed.value, ctx), 201);
  }, request);
}
