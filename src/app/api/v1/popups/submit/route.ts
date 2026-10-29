/**
 * /api/v1/popups/submit  (public)
 *   POST → submit a newsletter/lead popup { popupId, email, name?, phone?, message? }.
 *
 * Creates a Lead (so it shows in the admin Leads inbox) and bumps the popup's
 * submission counter.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { popupController } from "@/modules/popups";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return popupController.submit(body);
  });
}
