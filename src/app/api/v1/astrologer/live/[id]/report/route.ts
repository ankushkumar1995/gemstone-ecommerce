/** GET /api/v1/astrologer/live/:id/report  (owner astrologer) → { report }  after-live report (numbers so far while live) */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { liveReport } from "@/modules/live";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await liveReport(g.value.astrologer.id, id);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk({ report: r.value });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
