/**
 * /api/v1/users  (admin)
 *   GET  → list users. Paginated/filtered when query params are present
 *          (?page/limit/sort/q/status/roleId), else a plain array.
 *   POST → create / invite a user (rate-limited, privilege-checked).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { userController } from "@/modules/users";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const wantsPage =
    sp.has("page") || sp.has("limit") || sp.has("sort") || sp.has("q") || sp.has("status") || sp.has("roleId");
  if (wantsPage) {
    return handle(async () => {
      const guard = await requireAdmin("users:view");
      if (!guard.ok) return jsonError(guard.error);
      return userController.listPaginated(sp);
    }, request);
  }
  return handle(async () => {
    const guard = await requireAdmin("users:view");
    if (!guard.ok) return jsonError(guard.error);
    return userController.list();
  }, request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("users:create");
    if (!guard.ok) return jsonError(guard.error);

    const rl = rateLimit(`users:create:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }

    const actor = await actorFromSession(guard.value.session);
    const body = await request.json().catch(() => null);
    return userController.create(body, actor);
  }, request);
}
