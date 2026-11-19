/**
 * POST /api/v1/admin/remedy-sales/:id { reason }  (admin, payouts:edit)
 *   Reverse the commission on one sale. A confirmed one is taken back from the
 *   astrologer's earnings with a ledger row. → { sale }
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { remedyService } from "@/modules/remedies";

export const dynamic = "force-dynamic";

const schema = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(300) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin("payouts:edit");
  if (!g.ok) return jsonError(g.error);
  const { id } = await params;
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const r = await remedyService.adminReverse(id, p.value.reason, who);
  return r.ok ? jsonOk({ sale: r.value }) : jsonError(r.error);
}
