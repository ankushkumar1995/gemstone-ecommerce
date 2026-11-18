/** DELETE /api/v1/astrologer/blocks/:id  (approved astrologer) → { ok }  unblock */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { blockService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await blockService.unblock(g.value.astrologer.id, id);
  return r.ok ? jsonOk(r.value) : jsonError(r.error);
}
