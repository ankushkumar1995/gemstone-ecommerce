/** GET /api/v1/astrologer/blocks?cursor=  (approved astrologer) → { total, items, nextCursor }  people this astrologer blocked */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { blockService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk(await blockService.list(g.value.astrologer.id, request.nextUrl.searchParams.get("cursor")));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
