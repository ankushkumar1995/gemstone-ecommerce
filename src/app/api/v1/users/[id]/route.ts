/**
 * /api/v1/users/:id  (admin)
 *   GET    → single user
 *   PATCH  → update (name / phone / role / status / avatar) — privilege-checked
 *   DELETE → soft delete — privilege-checked
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { userController } from "@/modules/users";

export const dynamic = "force-dynamic";

function throttle(request: NextRequest) {
  const rl = rateLimit(`users:write:${clientIp(request.headers)}`, { limit: 30, windowSeconds: 60 });
  return rl.allowed ? null : jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("users:view");
    if (!guard.ok) return jsonError(guard.error);
    const { id } = await params;
    return userController.get(id);
  }, request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("users:edit");
    if (!guard.ok) return jsonError(guard.error);
    const limited = throttle(request);
    if (limited) return limited;
    const actor = await actorFromSession(guard.value.session);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return userController.update(id, body, actor);
  }, request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const guard = await requireAdmin("users:delete");
    if (!guard.ok) return jsonError(guard.error);
    const limited = throttle(request);
    if (limited) return limited;
    const actor = await actorFromSession(guard.value.session);
    const { id } = await params;
    return userController.remove(id, actor);
  }, request);
}
