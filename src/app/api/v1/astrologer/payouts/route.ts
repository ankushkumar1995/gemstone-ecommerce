/**
 * /api/v1/astrologer/payouts  (approved astrologer)
 *   GET                              → { payouts, balance, rules }
 *   POST { amountPaise?, requestId } → { payout }  withdraw (default: everything withdrawable)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

const schema = z.object({
  amountPaise: z.number().int().positive().optional(),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
});

export async function GET() {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const id = g.value.astrologer.id;
  const [payouts, balance, rules] = await Promise.all([earningsService.payouts(id), earningsService.balance(id), earningsService.rules()]);
  const out = jsonOk({ payouts, balance, rules });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`payout:request:${g.value.astrologer.id}`, { limit: 10, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please wait a few minutes."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await earningsService.request(g.value.astrologer.id, p.value, "astrologer");
  return r.ok ? jsonOk({ payout: r.value }, 201) : jsonError(r.error);
}
