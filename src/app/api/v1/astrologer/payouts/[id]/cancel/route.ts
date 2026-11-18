/** POST /api/v1/astrologer/payouts/:id/cancel  (astrologer) → { payout }  cancel a payout still waiting for approval. */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await earningsService.cancel(g.value.astrologer.id, id);
  return r.ok ? jsonOk({ payout: r.value }) : jsonError(r.error);
}
