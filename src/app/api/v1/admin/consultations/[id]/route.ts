/**
 * /api/v1/admin/consultations/:id  (admin)
 *   GET                                         → { session, messages }  full transcript
 *   POST { action: "end" }                      → end a live chat
 *   POST { action: "refund", amountPaise, reason, requestId } → refund to the customer's wallet (never more than charged)
 *   POST { action: "review", approve }          → moderate the customer's rating
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { consultService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("refund"), amountPaise: z.number().int().positive(), reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(300), requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/) }),
  z.object({ action: z.literal("review"), approve: z.boolean() }),
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("consultations:view");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await consultService.adminGet(id);
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
  const r = v.action === "end" ? await consultService.adminEnd(id, who)
    : v.action === "refund" ? await consultService.adminRefund(id, v.amountPaise, v.reason, who, v.requestId)
    : await consultService.moderateReview(id, v.approve);
  return r.ok ? jsonOk({ session: r.value }) : jsonError(r.error);
}
