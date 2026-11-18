/**
 * GET /api/v1/astrologer/consult/inbox?sig=<last>&wait=1  (approved astrologer, partner panel)
 *   → { requests, active, sig }  waiting chat requests + the live chat. Long-poll:
 *     answers at once when `sig` differs from the current state, else waits ~20 s.
 *     Also refreshes the astrologer's presence heartbeat while the panel is open.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { astrologerService } from "@/modules/astrologers";
import { consultService, maybeSweepConsultations, waitlistService } from "@/modules/consultations";
import { beatLiveOf, currentLiveOf } from "@/modules/live";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const sigOf = (x: Awaited<ReturnType<typeof consultService.inbox>>) =>
  [...x.requests.map((r) => `${r.id}:${r.version}`), x.active ? `a${x.active.id}:${x.active.version}:${x.active.msgSeq}` : ""].join("|");

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const id = g.value.astrologer.id;
  const sp = request.nextUrl.searchParams;
  const want = sp.get("sig") ?? "-";
  const until = Date.now() + (sp.get("wait") === "1" ? 20_000 : 0);
  if (g.value.astrologer.presence.online) await astrologerService.presence(id, { action: "heartbeat" }).catch(() => undefined);
  maybeSweepConsultations();
  await beatLiveOf(id).catch(() => undefined);
  for (;;) {
    const x = await consultService.inbox(id);
    const live = await currentLiveOf(id).catch(() => null);
    const waiting = await waitlistService.count(id).catch(() => 0);
    const sig = `${sigOf(x)}|${live ? `L${live.id}` : ""}|W${waiting}`;
    if (sig !== want || Date.now() >= until) {
      const out = jsonOk({ ...x, live: live ? { id: live.id, title: live.title, startedAt: live.startedAt } : null, waiting, sig });
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
