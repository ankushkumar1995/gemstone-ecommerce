/**
 * /api/v1/leads/:id
 *   PATCH → update a lead's status. Admin only (leads:edit).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { leadController } from "@/modules/leads";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const g = await requireAdmin("leads:edit");
    if (!g.ok) return jsonError(g.error);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return leadController.updateStatus(id, body);
  });
}
