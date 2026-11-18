/**
 * /api/v1/admin/payouts/:id  (admin)
 *   GET                                         → { payout, destination, balance }  (full account: payouts:edit)
 *   POST { action: "approve" }
 *   POST { action: "reject", reason }
 *   POST { action: "mark_paid", utr }           manual bank transfer done
 *   POST { action: "mark_failed", reason }      transfer bounced / failed (money goes back)
 *   POST { action: "send" }                     RazorpayX automatic payout
 *   POST { action: "refresh" }                  ask RazorpayX for the latest status
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "reject", "mark_paid", "mark_failed", "send", "refresh"]),
  utr: z.string().trim().max(40).optional(),
  reason: z.string().trim().max(300).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("payouts:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const r = await earningsService.adminGet(id);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("payouts:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const r = await earningsService.adminAction(id, p.value.action, { utr: p.value.utr, reason: p.value.reason }, who);
  return r.ok ? jsonOk({ payout: r.value }) : jsonError(r.error);
}
