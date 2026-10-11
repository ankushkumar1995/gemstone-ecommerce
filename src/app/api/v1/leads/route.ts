/**
 * /api/v1/leads
 *   POST → create a lead (contact / service / newsletter form)
 *   GET  → list all leads (admin)
 *
 * Thin route handler: parse request, delegate to the controller, let `handle`
 * convert any unexpected throw into a safe error envelope.
 */

import type { NextRequest } from "next/server";
import { handle } from "@/core/http";
import { leadController } from "@/modules/leads";

// Leads are always request-time (never cached).
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    return leadController.create(body);
  });
}

export async function GET() {
  return handle(() => leadController.list());
}
