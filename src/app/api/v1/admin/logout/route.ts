/**
 * /api/v1/admin/logout
 *   POST → clear the session cookie.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(() => adminAuthController.logout(request), request);
}
