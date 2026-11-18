/**
 * /api/v1/consult/waitlist  (customer)
 *   POST { astrologerId, question? } → { entry }  join the line of a busy astrologer
 *   GET                              → { entry }  my place (or the last one that closed in 10 min), null if none
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { waitlistService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

const schema = z.object({ astrologerId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid astrologer"), question: z.string().max(500).optional().default("") });

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`waitlist:join:${g.value.customerId}`, { limit: 15, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Please wait a few minutes."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await waitlistService.join(g.value.customerId, p.value.astrologerId, p.value.question);
  return r.ok ? jsonOk({ entry: r.value }, 201) : jsonError(r.error);
}

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ entry: await waitlistService.mine(g.value.customerId) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
