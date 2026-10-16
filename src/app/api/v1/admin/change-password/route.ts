/**
 * /api/v1/admin/change-password
 *   POST → the signed-in admin changes their own password (first-login or
 *          from settings). body: { currentPassword?, newPassword }
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`change-pw:${clientIp(request.headers)}`, { limit: 10, windowSeconds: 15 * 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Try again later."));
    const body = await request.json().catch(() => null);
    return adminAuthController.changePassword(body);
  }, request);
}
