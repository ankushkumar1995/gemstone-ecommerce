/**
 * /api/v1/users/:id/restore  (admin)
 *   POST → undo a soft delete.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin } from "@/modules/admin-auth/guard";
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
    const { id } = await params;
    return userController.restore(id);
  }, request);
}
