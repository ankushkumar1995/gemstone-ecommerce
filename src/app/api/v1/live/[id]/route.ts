/**
 * GET /api/v1/live/:id?after=<seq>&v=<version>&wait=1  (anyone; signed-in viewers are counted)
 *   → { live, events, me, queue, gifts }  long-poll: answers at once when something
 *     changed, otherwise waits up to ~20 s. `after` = last event seq the client has.
 *     A request with an expired app token gets 401 (so the app refreshes) instead
 *     of silently watching as a guest.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { clientIp, rateLimit } from "@/core/rate-limit";
import { liveService, liveWho, maybeSweepLives } from "@/modules/live";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await liveWho();
  if (!who.customerId && !who.astrologerId && request.headers.get("authorization")) return jsonError(AppErrors.unauthorized("Session expired"));
  const { id } = await params;
  const me = who.customerId ?? who.astrologerId ?? `ip:${clientIp(request.headers)}`;
  const rl = rateLimit(`live:events:${me}:${id}`, { limit: 240, windowSeconds: 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Reconnecting too fast. Please wait a moment."));
  maybeSweepLives();
  const sp = request.nextUrl.searchParams;
  const n = (k: string, d: number) => { const x = Number(sp.get(k)); return Number.isFinite(x) ? Math.floor(x) : d; };
  const r = await liveService.events(who, id, Math.max(0, n("after", 0)), n("v", -1), sp.get("wait") === "1" ? 20_000 : 0);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
