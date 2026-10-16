/**
 * /api/v1/categories/:id/status  (admin)
 *   PATCH → activate / deactivate a category (storefront visibility).
 *     body: { status: "active" | "inactive" }
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const rl = rateLimit(`categories:write:${clientIp(request.headers)}`, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { status?: string } | null;
    if (body?.status !== "active" && body?.status !== "inactive") {
      return jsonError(AppErrors.validation('status must be "active" or "inactive"'));
    }
    return categoryController.setStatus(id, body.status);
  }, request);
}
