/**
 * /api/v1/popups  (admin)
 *   GET  → list all popups (priority desc)
 *   POST → create a popup
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { popupController } from "@/modules/popups";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => popupController.list());
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return popupController.create(body);
  });
}
