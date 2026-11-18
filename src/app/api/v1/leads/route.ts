/**
 * /api/v1/leads
 *   POST → create a lead (contact / service / consultation / newsletter form).
 *          Public, rate-limited per IP.
 *   GET  → list leads. Admin only (leads:view): leads hold customer PII.
 *
 * Thin route handler: parse request, delegate to the controller, let `handle`
 * convert any unexpected throw into a safe error envelope.
 */

import type { NextRequest } from "next/server";
import { handle, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { rateLimit, clientIp } from "@/core/rate-limit";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { leadController } from "@/modules/leads";

// Leads are always request-time (never cached).
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handle(async () => {
    // Generous for real visitors, stops a script from flooding the inbox.
    const rl = rateLimit(`leads:create:${clientIp(request.headers)}`, { limit: 10, windowSeconds: 10 * 60 });
    if (!rl.allowed) {
      return jsonError(AppErrors.rateLimited(`Too many requests. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`));
    }
    const body = await request.json().catch(() => null);
    return leadController.create(body);
  });
}

export async function GET() {
  return handle(async () => {
    const g = await requireAdmin("leads:view");
    if (!g.ok) return jsonError(g.error);
    return leadController.list();
  });
}
