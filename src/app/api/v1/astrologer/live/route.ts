/**
 * /api/v1/astrologer/live  (approved astrologer, partner panel)
 *   GET                                   → { current, scheduled, past }
 *   POST { title, topic?, tags?, scheduledAt? }  → { live }  go live now, or schedule (scheduledAt ISO)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { liveService, maybeSweepLives, LIVE_TAGS } from "@/modules/live";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(3, "Add a title (at least 3 characters)").max(80),
  topic: z.string().trim().max(200).optional(),
  tags: z.array(z.enum(LIVE_TAGS)).max(3, "Pick up to 3 topics").optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET() {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  maybeSweepLives();
  const out = jsonOk(await liveService.mine(g.value.astrologer.id));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`live:create:${g.value.astrologer.id}`, { limit: 10, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please wait a few minutes."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await liveService.create(g.value.astrologer.id, p.value);
  return r.ok ? jsonOk({ live: r.value }, 201) : jsonError(r.error);
}
