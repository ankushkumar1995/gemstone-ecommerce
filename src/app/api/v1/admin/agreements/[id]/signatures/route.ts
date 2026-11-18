/** GET /api/v1/admin/agreements/:id/signatures — who signed this version and who did not (astrologers:view). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { agreementService } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:view");
    if (!g.ok) return jsonError(g.error);
    return toResponse(await agreementService.signatures((await params).id));
  }, request);
}
