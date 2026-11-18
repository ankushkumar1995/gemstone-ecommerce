/** POST /api/v1/admin/agreements/:id/remind — email unsigned approved partners ({ astrologerIds? }) (astrologers:edit). */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { agreementService, remindSchema } from "@/modules/agreements";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("astrologers:edit");
    if (!g.ok) return jsonError(g.error);
    const { id } = await params;
    // Protects partners from being spammed by repeated clicks.
    const rl = rateLimit(`agr-remind:${id}`, { limit: 3, windowSeconds: 3600 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Reminders were sent recently. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
    const parsed = parse(remindSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    return toResponse(await agreementService.remind(id, parsed.value.astrologerIds, { name: g.value.session.user.name }));
  }, request);
}
