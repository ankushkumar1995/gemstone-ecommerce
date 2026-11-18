/**
 * /api/v1/account/sessions  (customer)
 *   GET  → signed-in devices (current one marked)
 *   POST { action: "revoke-others" } → sign out every other device
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { sessionService } from "@/modules/customer-auth/session.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  return jsonOk(await sessionService.list(g.value.customerId, g.value.sessionId));
}

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "revoke-others") return jsonError(AppErrors.validation("Unknown action"));
  const n = await sessionService.revokeAll(g.value.customerId, "signed_out_by_user", g.value.sessionId);
  return jsonOk({ signedOut: n });
}
