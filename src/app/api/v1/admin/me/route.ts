/**
 * /api/v1/admin/me
 *   GET → the current signed-in admin (for the UI). 401 if no valid session.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { adminAuthController } from "@/modules/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(() => adminAuthController.me(), request);
}
