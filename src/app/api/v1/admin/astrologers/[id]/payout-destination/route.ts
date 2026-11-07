/** GET /api/v1/admin/astrologers/:id/payout-destination — unmasked bank/UPI + PAN for settlement (payouts:edit, audited). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { auditService } from "@/modules/audit";
import { astrologerService } from "@/modules/astrologers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("payouts:edit");
    if (!g.ok) return jsonError(g.error);
    void parse; void body;
    const { id } = await params;
    const res = await astrologerService.payoutDestination(id);
    if (res.ok) await auditService.record({ action: "update", entity: "payout", entityId: id, entityLabel: id, summary: "Revealed payout destination", actor: g.value.session.user.name });
    return toResponse(res);
  }, request);
}