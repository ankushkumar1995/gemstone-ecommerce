/** GET /api/v1/astrologer/consult/history  (astrologer) → { sessions }  my chats, newest first. */
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { consultService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireAstrologer();
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ sessions: await consultService.history({ astrologerId: g.value.astrologer.id }, 100) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
