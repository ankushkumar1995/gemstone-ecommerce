/**
 * /api/v1/consult/sessions  (customer; app + website)
 *   POST { astrologerId, requestId, question? } → { session }   chat request (idempotent on requestId)
 *   GET                                         → { sessions }  my chat history, newest first
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { consultService, maybeSweepConsultations } from "@/modules/consultations";

export const dynamic = "force-dynamic";

const schema = z.object({
  astrologerId: z.string().trim().regex(/^[a-f0-9]{24}$/i, "Invalid astrologer"),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
  question: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const rl = rateLimit(`consult:request:${g.value.customerId}`, { limit: 12, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many chat requests. Please wait a few minutes."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  maybeSweepConsultations();
  const r = await consultService.request(g.value.customerId, p.value);
  return r.ok ? jsonOk({ session: r.value }, 201) : jsonError(r.error);
}

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ sessions: await consultService.history({ customerId: g.value.customerId }) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
