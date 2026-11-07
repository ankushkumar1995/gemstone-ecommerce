/** POST /api/v1/astrologer/status — self actions: submit for review, re-apply, or deactivate. */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse, z } from "@/core/validation";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { body } from "@/modules/astrologer-auth/http";
import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";
const schema = z.object({ status: z.enum(["under_review", "deactivated"]), reason: z.string().trim().max(500).optional() });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const g = await requireAstrologer();
    if (!g.ok) return jsonError(g.error);
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const a = g.value.astrologer;
    const res = await astrologerService.changeStatus(a.id, parsed.value.status, parsed.value.reason, { name: a.displayName, kind: "self" });
    if (!res.ok) return jsonError(res.error);
    return toResponse(await astrologerService.getSelf(a.id));
  }, request);
}