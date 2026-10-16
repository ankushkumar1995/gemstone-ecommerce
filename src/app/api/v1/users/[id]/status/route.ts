/**
 * /api/v1/users/:id/status  (admin)
 *   PATCH → activate / disable / suspend a user.
 *     body: { status: "active" | "invited" | "disabled" | "suspended", reason? }
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { userController } from "@/modules/users";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("users:edit");
    if (!guard.ok) return jsonError(guard.error);
    const rl = rateLimit(`users:write:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));

    const actor = await actorFromSession(guard.value.session);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return userController.setStatus(id, body, actor);
  }, request);
}
