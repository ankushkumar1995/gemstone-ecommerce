/**
 * GET /api/v1/admin/payouts/export?status=approved  (admin, payouts:edit)
 *   → CSV with full account numbers for a bank bulk upload. Audited.
 */
import type { NextRequest } from "next/server";
import { jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { auditService } from "@/modules/audit";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await requireAdmin("payouts:edit");
  if (!g.ok) return jsonError(g.error);
  const status = request.nextUrl.searchParams.get("status") ?? "approved";
  const csv = await earningsService.exportCsv(status);
  await auditService.record({ action: "update", entity: "payout", summary: `Exported ${status} payouts (bank details) as CSV`, actor: g.value.session.user.name || g.value.session.user.email || "Admin" }).catch(() => undefined);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payouts-${status}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
