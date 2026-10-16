/**
 * /api/v1/users/:id/reset-password  (admin)
 *   POST → reset another user's password. If body has no password, a strong
 *          temp one is generated and returned ONCE. Forces change on next login.
 *     body: { password? }
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { userController } from "@/modules/users";

export const dynamic = "force-dynamic";

export async function POST(
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
    return userController.resetPassword(id, body, actor);
  }, request);
}
