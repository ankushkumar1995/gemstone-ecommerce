/** GET /api/v1/astrologer/followers?cursor=  (approved astrologer) → { total, last7, last30, alertsOn, items, nextCursor } */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { followService } from "@/modules/live";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk(await followService.forAstrologer(g.value.astrologer.id, request.nextUrl.searchParams.get("cursor") ?? undefined));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
