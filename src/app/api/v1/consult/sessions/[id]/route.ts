/**
 * GET /api/v1/consult/sessions/:id?after=<seq>&v=<version>&wait=1  (customer or astrologer)
 *   → { session, messages }  long-poll: answers at once when something changed,
 *     otherwise waits up to ~20 s. `after` = last message seq the client has;
 *     `v` = the session version it has. wait=0 answers immediately.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { consultService, consultWho } from "@/modules/consultations";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const w = await consultWho();
  if (!w.ok) return jsonError(w.error);
  const { id } = await params;
  const rl = rateLimit(`consult:events:${w.value.customerId ?? w.value.astrologerId}:${id}`, { limit: 240, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Reconnecting too fast. Please wait a moment."));
  const sp = request.nextUrl.searchParams;
  const n = (k: string, d: number) => { const x = Number(sp.get(k)); return Number.isFinite(x) ? Math.floor(x) : d; };
  const r = await consultService.events(w.value, id, Math.max(0, n("after", 0)), n("v", -1), sp.get("wait") === "1" ? 20_000 : 0);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
