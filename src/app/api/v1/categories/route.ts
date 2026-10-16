/**
 * /api/v1/categories
 *   GET  → list all categories (ordered, cached)
 *   POST → create a category (admin, rate-limited)
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // If the client asks for a page/search/sort, return the paginated envelope;
  // otherwise return the plain ordered list (storefront compatibility).
  const wantsPage = sp.has("page") || sp.has("limit") || sp.has("sort") || sp.has("q");
  if (wantsPage) {
    return handle(() => categoryController.listPaginated(sp), request);
  }
  return handle(() => categoryController.list(), request);
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    // Throttle writes: 20 creates / minute per IP.
    const rl = rateLimit(`categories:create:${clientIp(request.headers)}`, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return jsonError(
        AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`),
      );
    }
    const body = await request.json().catch(() => null);
    return categoryController.create(body);
  }, request);
}
