/**
 * /api/v1/storage  (admin only)
 *   GET    → list objects in a folder          ?folder=products
 *   DELETE → delete one or many objects         body: { key } | { keys: [] }
 *
 * All actions require a valid admin session + the relevant media permission.
 * The storefront can never call these (no session → 401).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { storageService } from "@/modules/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("media:view");
    if (!guard.ok) return jsonError(guard.error);

    const folder = request.nextUrl.searchParams.get("folder") ?? "";
    return toResponse(await storageService.list(folder));
  });
}

export async function DELETE(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("media:delete");
    if (!guard.ok) return jsonError(guard.error);

    const body = (await request.json().catch(() => null)) as
      | { key?: string; keys?: string[] }
      | null;

    const keys = body?.keys && Array.isArray(body.keys)
      ? body.keys
      : body?.key
        ? [body.key]
        : [];

    if (keys.length === 0) {
      return jsonError(AppErrors.validation("Provide `key` or `keys` to delete"));
    }
    return toResponse(await storageService.removeMany(keys));
  });
}
