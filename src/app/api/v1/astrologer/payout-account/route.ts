/** PUT /api/v1/astrologer/payout-account — set bank or UPI details (re-verification required). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body, limit } from "@/modules/astrologer-auth/http";
import { astrologerService, payoutAccountSchema } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const rl = limit(request, `astro:payout-acct:${g.value.astrologer.id}`, 5, 24 * 60 * 60);
    if (rl) return jsonError(rl);
    const parsed = parse(payoutAccountSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await astrologerService.setPayoutAccount(g.value.astrologer.id, parsed.value));
  }, request);
}