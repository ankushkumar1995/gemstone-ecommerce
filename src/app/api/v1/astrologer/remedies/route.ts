/**
 * GET /api/v1/astrologer/remedies  (approved astrologer)
 *   ?status=waiting|in_window|confirmed|reversed&before=<createdAt>
 *     → { rules, stats, items, nextBefore, recent }  remedy sales from your suggestions
 *   ?sessionId=<chat id>
 *     → { rules, suggestions }  what you suggested in that chat
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { remedyService } from "@/modules/remedies";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const me = g.value.astrologer.id;
  const sessionId = sp.get("sessionId");
  const body = sessionId
    ? { rules: await remedyService.rules(), suggestions: (await remedyService.forSession(sessionId)).filter((s) => s.astrologerId === me) }
    : await remedyService.partner(me, { status: sp.get("status") ?? undefined, before: sp.get("before") ?? undefined });
  const out = jsonOk(body);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
