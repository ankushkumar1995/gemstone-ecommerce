/**
 * /api/v1/storage/upload  (admin only)
 *   POST (multipart/form-data) → upload a file to S3 via the server.
 *     fields: file (File), folder (string, e.g. "products")
 *
 * Best for images and small files. For large videos, use /presign so the
 * browser uploads directly to S3. Requires a logged-in admin session.
 *
 * NOTE: the fine-grained "media:create" permission check is temporarily
 * relaxed to just "logged-in admin" (older sessions lack the new RBAC
 * permissions). Re-tighten to requireAdmin("media:create") once sessions
 * carry permissions (re-login refreshes them).
 */

import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { storageService } from "@/modules/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const guard = await requireAdmin("media:create");
    if (!guard.ok) return jsonError(guard.error);

    const form = await request.formData().catch(() => null);
    if (!form) return jsonError(AppErrors.validation("Expected multipart form data"));

    const file = form.get("file");
    const folder = String(form.get("folder") ?? "media");

    if (!(file instanceof File)) {
      return jsonError(AppErrors.validation("No file provided"));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await storageService.upload({
      folder,
      fileName: file.name || "upload",
      contentType: file.type || "application/octet-stream",
      body: buffer,
    });

    return toResponse(result, 201);
  });
}

// Allow larger request bodies for image uploads.
export const maxDuration = 60;
