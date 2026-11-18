/**
 * /api/v1/admin/live/:id  (admin)
 *   GET                              → { live, viewers, events, queue }
 *   POST { action: "end" }           → end (or cancel a scheduled) live
 *   POST { action: "hide", seq }     → hide a comment for everyone
 *   POST { action: "feature", on }   → pin to the top of the app feed (or unpin)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { liveService } from "@/modules/live";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("hide"), seq: z.number().int().positive() }),
  z.object({ action: z.literal("feature"), on: z.boolean() }),
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("consultations:view");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await liveService.adminGet(id);
  return r.ok ? jsonOk(r.value) : jsonError(r.error);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("consultations:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const v = p.value;
  const r = v.action === "end" ? await liveService.adminEnd(id, who) : v.action === "feature" ? await liveService.adminFeature(id, v.on, who) : await liveService.adminHide(id, v.seq, who);
  return r.ok ? jsonOk({ live: r.value }) : jsonError(r.error);
}
