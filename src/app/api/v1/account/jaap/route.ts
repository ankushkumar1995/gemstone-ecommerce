/**
 * /api/v1/account/jaap  (signed-in customer)
 *   GET                              → { jaap }  total, today, streak, per mantra
 *   POST { slug, count, clientId }   → { jaap }  add recitations (idempotent on clientId)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { devotionalService } from "@/modules/devotional";

export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().trim().min(2).max(80),
  count: z.number().int().min(1).max(1008),
  clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,64}$/, "Invalid id"),
});

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ jaap: await devotionalService.myJaap(g.value.customerId) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`jaap:${g.value.customerId}`, { limit: 120, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Too many updates. Please wait a moment."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await devotionalService.addJaap(g.value.customerId, p.value);
  return r.ok ? jsonOk({ jaap: r.value }) : jsonError(r.error);
}
