/**
 * /api/v1/storage/presign  (admin only)
 *   POST → get a presigned PUT URL so the browser can upload a (large) file
 *          directly to S3 without routing bytes through the server.
 *     body: { folder, fileName, contentType }
 *
 * Admin session + "media:create" required. The storefront can't call this.
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

    const body = (await request.json().catch(() => null)) as
      | { folder?: string; fileName?: string; contentType?: string }
      | null;

    if (!body?.folder || !body.fileName || !body.contentType) {
      return jsonError(AppErrors.validation("folder, fileName and contentType are required"));
    }

    return toResponse(
      await storageService.presignUpload({
        folder: body.folder,
        fileName: body.fileName,
        contentType: body.contentType,
      }),
    );
  });
}
