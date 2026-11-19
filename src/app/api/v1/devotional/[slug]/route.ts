/**
 * /api/v1/devotional/:slug  (public)
 *   GET           → { item }  full text, verses, audio
 *   POST play     → counts a play (light rate limit per network)
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { clientIp, rateLimit } from "@/core/rate-limit";
import { devotionalService } from "@/modules/devotional";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await devotionalService.get(slug);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk({ item: r.value });
  out.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  return out;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (rateLimit(`devo:play:${clientIp(request.headers)}:${slug}`, { limit: 6, windowSeconds: 600 }).allowed) await devotionalService.played(slug).catch(() => undefined);
  return jsonOk({ ok: true });
}
