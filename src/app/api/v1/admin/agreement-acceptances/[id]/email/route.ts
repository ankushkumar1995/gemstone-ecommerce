/** POST /api/v1/admin/agreement-acceptances/:id/email — email the signed PDF + a fresh link to the partner (astrologers:edit). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { rateLimit } from "@/core/rate-limit";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { agreementService } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const { id } = await params;
    const rl = rateLimit(`agr-email-copy:${id}`, { limit: 3, windowSeconds: 3600 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("This copy was emailed recently. Try again later."));
    return toResponse(await agreementService.emailCopy(id, { name: g.value.session.user.name }));
  }, request);
}
