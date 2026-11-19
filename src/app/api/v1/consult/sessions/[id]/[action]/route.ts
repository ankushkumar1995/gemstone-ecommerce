/**
 * POST /api/v1/consult/sessions/:id/:action  (customer or astrologer; the session decides the role)
 *   messages { text, clientId }      send (idempotent on clientId; contacts masked)
 *   typing                           typing indicator
 *   read     { seq }                 seen ticks
 *   end                              end the chat (bill stops at the current minute)
 *   cancel                           customer: withdraw a request not accepted yet
 *   rate     { stars, text }         customer, after the chat
 *   report   { reason }              either side
 *   accept / decline                 astrologer, while requested
 *   block    { reason }              astrologer: block this customer
 *   suggest  { kind, itemId, note?, clientId }  astrologer: send a product / pooja card (remedy commission)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { consultService, consultWho } from "@/modules/consultations";

export const dynamic = "force-dynamic";

const msg = z.object({ text: z.string().max(2000), clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid message id") });
const read = z.object({ seq: z.number().int().min(0) });
const rate = z.object({ stars: z.number().int().min(1).max(5), text: z.string().max(500).optional().default("") });
const reason = z.object({ reason: z.string().trim().min(3, "Tell us what happened").max(500) });
const suggest = z.object({
  kind: z.enum(["product", "pooja"]),
  itemId: z.string().trim().min(1).max(64),
  note: z.string().max(300).optional().default(""),
  clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid message id"),
});
const tip = z.object({ amountPaise: z.number().int().min(100).max(10_000_000), requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const w = await consultWho();
  if (!w.ok) return jsonError(w.error);
  const { id, action } = await params;
  const me = w.value.customerId ?? w.value.astrologerId ?? "";
  const body = await request.json().catch(() => ({}));
  const limit = (key: string, n: number) => rateLimit(`consult:${key}:${me}`, { limit: n, windowSeconds: 60 }).allowed;

  switch (action) {
    case "messages": {
      if (!limit("msg", 90)) return jsonError(AppErrors.rateLimited("You are sending too fast. Please slow down."));
      const p = parse(msg, body);
      if (!p.ok) return jsonError(p.error);
      const r = await consultService.send(w.value, id, p.value.text, p.value.clientId);
      return r.ok ? jsonOk({ message: r.value }, 201) : jsonError(r.error);
    }
    case "typing":
      if (limit("typing", 60)) await consultService.typing(w.value, id);
      return jsonOk({ ok: true });
    case "read": {
      const p = parse(read, body);
      if (!p.ok) return jsonError(p.error);
      await consultService.read(w.value, id, p.value.seq);
      return jsonOk({ ok: true });
    }
    case "end": {
      const r = await consultService.end(w.value, id);
      return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
    }
    case "cancel": {
      if (!w.value.customerId) return jsonError(AppErrors.forbidden("Only the customer can cancel a request"));
      const r = await consultService.cancel(w.value.customerId, id);
      return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
    }
    case "rate": {
      if (!w.value.customerId) return jsonError(AppErrors.forbidden("Only the customer can rate"));
      const p = parse(rate, body);
      if (!p.ok) return jsonError(p.error);
      const r = await consultService.rate(w.value.customerId, id, p.value.stars, p.value.text);
      return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
    }
    case "tip": {
      if (!w.value.customerId) return jsonError(AppErrors.forbidden("Only the customer can tip"));
      if (!limit("tip", 10)) return jsonError(AppErrors.rateLimited("Please wait a moment."));
      const p = parse(tip, body);
      if (!p.ok) return jsonError(p.error);
      const r = await consultService.tip(w.value.customerId, id, p.value.amountPaise, p.value.requestId);
      return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
    }
    case "report": {
      if (!limit("report", 5)) return jsonError(AppErrors.rateLimited("Please wait before reporting again."));
      const p = parse(reason, body);
      if (!p.ok) return jsonError(p.error);
      const r = await consultService.report(w.value, id, p.value.reason);
      return r.ok ? jsonOk(r.value) : jsonError(r.error);
    }
    case "accept":
    case "decline": {
      if (!w.value.astrologerId) return jsonError(AppErrors.forbidden("Only the astrologer can do this"));
      const r = action === "accept" ? await consultService.accept(w.value.astrologerId, id) : await consultService.decline(w.value.astrologerId, id);
      return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
    }
    case "suggest": {
      if (!w.value.astrologerId) return jsonError(AppErrors.forbidden("Only the astrologer can suggest a remedy"));
      if (!limit("suggest", 10)) return jsonError(AppErrors.rateLimited("Please wait a moment."));
      const p = parse(suggest, body);
      if (!p.ok) return jsonError(p.error);
      const { remedyService } = await import("@/modules/remedies");
      const r = await remedyService.suggest(w.value.astrologerId, id, p.value);
      return r.ok ? jsonOk(r.value, 201) : jsonError(r.error);
    }
    case "block": {
      if (!w.value.astrologerId) return jsonError(AppErrors.forbidden("Only the astrologer can block"));
      const p = parse(reason, body);
      if (!p.ok) return jsonError(p.error);
      const r = await consultService.block(w.value.astrologerId, id, p.value.reason);
      return r.ok ? jsonOk(r.value) : jsonError(r.error);
    }
    default:
      return jsonError(AppErrors.notFound("Unknown action"));
  }
}
