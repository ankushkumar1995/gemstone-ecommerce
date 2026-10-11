/**
 * /api/v1/settings
 *   GET   → read the store settings document (public: storefront reads it too)
 *   PATCH → update one or more settings sections (admin)
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { settingsController } from "@/modules/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => settingsController.get());
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return settingsController.update(body);
  });
}
