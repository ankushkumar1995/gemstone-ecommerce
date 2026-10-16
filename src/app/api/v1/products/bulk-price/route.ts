/**
 * /api/v1/products/bulk-price  (admin)
 *   POST → bulk price update across many products (products:edit).
 *     body: {
 *       ids: string[],
 *       mode: "percent" | "amount" | "set",
 *       value: number,           // -10 = 10% off | +500 | set price
 *       applyToMrp?: boolean,
 *       roundTo?: number          // e.g. 10 → nearest ₹10
 *     }
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin, actorFromSession } from "@/modules/admin-auth/guard";
import { productController } from "@/modules/products";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("products:edit");
    if (!guard.ok) return jsonError(guard.error);
    const rl = rateLimit(`products:write:${clientIp(request.headers)}`, { limit: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
    }
    await actorFromSession(guard.value.session);
    const body = await request.json().catch(() => null);
    return productController.bulkPrice(body);
  }, request);
}
