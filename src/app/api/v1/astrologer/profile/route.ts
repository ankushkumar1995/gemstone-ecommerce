/** PATCH /api/v1/astrologer/profile — edit own profile, rates and availability. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService, selfUpdateSchema } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(selfUpdateSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.updateSelf(g.value.astrologer.id, parsed.value));
  }, request);
}