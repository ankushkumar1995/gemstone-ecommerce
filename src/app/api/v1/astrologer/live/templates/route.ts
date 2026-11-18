/**
 * /api/v1/astrologer/live/templates  (approved astrologer)
 *   GET                                       → { templates }  quick replies + ask templates (own, or the defaults)
 *   PUT { quickReplies?, askTemplates? }      → { templates }  save a list; null = back to the defaults
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { liveTemplates } from "@/modules/live";

export const dynamic = "force-dynamic";

const list = z.array(z.string().max(300)).max(30).nullable().optional();
const schema = z.object({ quickReplies: list, askTemplates: list }).refine((v) => v.quickReplies !== undefined || v.askTemplates !== undefined, { message: "Nothing to save" });

export async function GET() {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ templates: await liveTemplates.get(g.value.astrologer.id) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function PUT(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`live:templates:${g.value.astrologer.id}`, { limit: 30, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Too many changes. Please wait a few minutes."));
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await liveTemplates.save(g.value.astrologer.id, p.value);
  return r.ok ? jsonOk({ templates: r.value }) : jsonError(r.error);
}
