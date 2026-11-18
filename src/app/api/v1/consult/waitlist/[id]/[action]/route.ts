/**
 * POST /api/v1/consult/waitlist/:id/:action  (customer)
 *   leave   → { entry }
 *   accept  → { entry, sessionId }  take the offered turn (makes the chat request)
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { waitlistService } from "@/modules/consultations";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const { id, action } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return jsonError(AppErrors.notFound("Not found"));
  if (action === "leave") {
    const r = await waitlistService.leave(g.value.customerId, id);
    return r.ok ? jsonOk({ entry: r.value }) : jsonError(r.error);
  }
  if (action === "accept") {
    const r = await waitlistService.accept(g.value.customerId, id);
    return r.ok ? jsonOk(r.value) : jsonError(r.error);
  }
  return jsonError(AppErrors.notFound("Unknown action"));
}
