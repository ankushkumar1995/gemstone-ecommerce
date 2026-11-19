/** POST /api/v1/admin/referrals/:id { decision: "approve" | "reject", note? }  (admin, wallets:edit) → { status } */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { referralService } from "@/modules/referrals";

export const dynamic = "force-dynamic";

const schema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(300).optional().default("") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("wallets:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const r = await referralService.adminDecide(id, p.value.decision, p.value.note, who);
  return r.ok ? jsonOk(r.value) : jsonError(r.error);
}
