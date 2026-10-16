/**
 * /api/v1/categories/:id/restore  (admin)
 *   POST → undo a soft delete.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function POST(
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
    return categoryController.restore(id);
  }, request);
}
