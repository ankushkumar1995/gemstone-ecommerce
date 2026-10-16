/**
 * /api/v1/categories/reorder  (admin)
 *   POST → set display order for many categories at once.
 *     body: { ids: string[] }  // new order, first = order 1
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const rl = rateLimit(`categories:write:${clientIp(request.headers)}`, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    const body = await request.json().catch(() => null);
    return categoryController.reorder(body);
  }, request);
}
