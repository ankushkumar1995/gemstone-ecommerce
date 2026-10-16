/**
 * /api/v1/admin/refresh
 *   POST → exchange a valid refresh token for a fresh access token (rotates
 *          the refresh token). Called by the client when the access token
 *          (15 min) expires.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(() => adminAuthController.refresh(request), request);
}
