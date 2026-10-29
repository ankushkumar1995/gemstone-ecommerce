/**
 * /api/v1/popups/event  (public)
 *   POST → record an analytics event { popupId, event }.
 *
 * Fire-and-forget from the client (sendBeacon / keepalive fetch). Never
 * blocks render; always returns quickly.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { popupController } from "@/modules/popups";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return popupController.event(body);
  });
}
