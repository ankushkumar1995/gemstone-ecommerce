/**
 * /api/v1/categories/:id
 *   GET    → single category
 *   PATCH  → update (admin)
 *   DELETE → remove (admin)
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { categoryController } from "@/modules/categories";

export const dynamic = "force-dynamic";

/** Shared write throttle: 30 mutations / minute per IP. */
function throttleWrite(request: NextRequest) {
  const rl = rateLimit(`categories:write:${clientIp(request.headers)}`, {
    limit: 30,
    windowSeconds: 60,
  });
  return rl.allowed
    ? null
    : jsonError(AppErrors.rateLimited(`Too many requests. Retry in ${rl.retryAfter}s.`));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const { id } = await params;
    return categoryController.get(id);
  }, request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const limited = throttleWrite(request);
    if (limited) return limited;
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return categoryController.update(id, body);
  }, request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(async () => {
    const limited = throttleWrite(request);
    if (limited) return limited;
    const { id } = await params;
    return categoryController.remove(id);
  }, request);
}
