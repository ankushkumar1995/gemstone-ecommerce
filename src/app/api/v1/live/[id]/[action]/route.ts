/**
 * POST /api/v1/live/:id/:action
 *   Viewer (signed-in customer):
 *     comment  { text, clientId }    masked, slow mode, idempotent on clientId
 *     like     { count }             hearts in batches (1-30)
 *     gift     { giftId, clientId, count? }  paid from the wallet (combo ×N, idempotent on clientId)
 *     ask      { question, paidPaise?, clientId? }  join the line; paidPaise = Super Chat tier
 *     remind   { on }                scheduled live: remind me when it starts
 *     unask                          leave the queue
 *     chat     { question? }         1-to-1 chat line with this astrologer (waitlist; turn comes when the live ends)
 *   Astrologer (owner, partner panel):
 *     comment  { text, clientId }
 *     start | cancel | end
 *     pin { seq | null } | hide { seq } | mute { seq } | block { seq, reason? }  (block = for good, every live + chat)
 *     settings { commentsOff?, slowSec?, queueOpen? }
 *     answer | done | skip { queueId }
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { liveService, liveWho, reminderService } from "@/modules/live";

export const dynamic = "force-dynamic";

const cid = z.string().trim().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid id");
const comment = z.object({ text: z.string().max(1000), clientId: cid });
const like = z.object({ count: z.number().int().min(1).max(30) });
const gift = z.object({ giftId: z.string().trim().min(1).max(30), clientId: cid, count: z.number().int().min(1).max(100).optional().default(1) });
const ask = z.object({ question: z.string().max(500), paidPaise: z.number().int().positive().optional(), clientId: cid.optional() }).refine((v) => !v.paidPaise || !!v.clientId, { message: "Missing request id" });
const remind = z.object({ on: z.boolean() });
const chat = z.object({ question: z.string().max(300).optional().default("") });

const ASTRO_ACTIONS = new Set(["start", "cancel", "end", "pin", "hide", "mute", "block", "settings", "answer", "done", "skip", "video-token", "video-on", "video-off"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const who = await liveWho();
  if (!who.customerId && !who.astrologerId) return jsonError(AppErrors.unauthorized("Please sign in to continue"));
  const { id, action } = await params;
  const me = who.astrologerId ?? who.customerId ?? "";
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const limit = (key: string, n: number) => rateLimit(`live:${key}:${me}`, { limit: n, windowSeconds: 60 }).allowed;

  if (ASTRO_ACTIONS.has(action)) {
    if (!who.astrologerId) return jsonError(AppErrors.forbidden("Only the astrologer can do this"));
    if (!limit("mod", 120)) return jsonError(AppErrors.rateLimited("Too many actions. Please slow down."));
    if (action === "video-token") {
      const t = await liveService.videoToken(who.astrologerId, id);
      return t.ok ? jsonOk(t.value) : jsonError(t.error);
    }
    const r = action === "start" ? await liveService.goLive(who.astrologerId, id)
      : action === "video-on" ? await liveService.videoOn(who.astrologerId, id)
      : action === "video-off" ? await liveService.videoOff(who.astrologerId, id)
      : action === "cancel" ? await liveService.cancelScheduled(who.astrologerId, id)
      : action === "end" ? await liveService.end(who.astrologerId, id)
      : await liveService.moderate(who.astrologerId, id, action, body);
    return r.ok ? jsonOk({ live: r.value }) : jsonError(r.error);
  }

  switch (action) {
    case "comment": {
      if (!limit("comment", 30)) return jsonError(AppErrors.rateLimited("You are commenting too fast. Please slow down."));
      const p = parse(comment, body);
      if (!p.ok) return jsonError(p.error);
      const r = await liveService.comment(who, id, p.value.text, p.value.clientId);
      return r.ok ? jsonOk(r.value, 201) : jsonError(r.error);
    }
    case "like": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Only viewers can like"));
      if (!limit("like", 60)) return jsonOk({ likes: null });
      const p = parse(like, body);
      if (!p.ok) return jsonError(p.error);
      const r = await liveService.like(who, id, p.value.count);
      return r.ok ? jsonOk(r.value) : jsonError(r.error);
    }
    case "gift": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Only viewers can send gifts"));
      if (!limit("gift", 30)) return jsonError(AppErrors.rateLimited("Too many gifts at once. Please wait a moment."));
      const p = parse(gift, body);
      if (!p.ok) return jsonError(p.error);
      const r = await liveService.gift(who.customerId, id, p.value.giftId, p.value.clientId, p.value.count);
      return r.ok ? jsonOk(r.value, 201) : jsonError(r.error);
    }
    case "ask": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Only viewers can ask"));
      if (!limit("ask", 10)) return jsonError(AppErrors.rateLimited("Please wait before asking again."));
      const p = parse(ask, body);
      if (!p.ok) return jsonError(p.error);
      const r = await liveService.joinQueue(who.customerId, id, p.value.question, p.value.paidPaise ? { pricePaise: p.value.paidPaise, clientId: p.value.clientId! } : undefined);
      return r.ok ? jsonOk({ me: r.value }) : jsonError(r.error);
    }
    case "remind": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Please sign in"));
      if (!limit("remind", 30)) return jsonError(AppErrors.rateLimited("Please wait a moment."));
      const p = parse(remind, body);
      if (!p.ok) return jsonError(p.error);
      const r = await reminderService.set(who.customerId, id, p.value.on);
      return r.ok ? jsonOk(r.value) : jsonError(r.error);
    }
    case "unask": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Only viewers can do this"));
      const r = await liveService.leaveQueue(who.customerId, id);
      return r.ok ? jsonOk({ me: r.value }) : jsonError(r.error);
    }
    case "chat": {
      if (!who.customerId) return jsonError(AppErrors.forbidden("Please sign in as a customer"));
      if (!limit("chat", 10)) return jsonError(AppErrors.rateLimited("Please wait a moment."));
      const p = parse(chat, body);
      if (!p.ok) return jsonError(p.error);
      const r = await liveService.privateChat(who.customerId, id, p.value.question);
      return r.ok ? jsonOk({ entry: r.value }, 201) : jsonError(r.error);
    }
    default:
      return jsonError(AppErrors.notFound("Unknown action"));
  }
}
