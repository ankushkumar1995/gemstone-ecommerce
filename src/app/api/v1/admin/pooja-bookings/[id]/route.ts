/**
 * /api/v1/admin/pooja-bookings/:id
 *   GET  → booking + the policy refund suggestion right now
 *   POST → one action (assign, proof, prasad, reschedule, cancel, refund, …).
 *          Money actions (cancel with refund, refund, mark paid) need poojas:delete
 *          or poojas:edit as noted; everything is audited.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, jsonOk, toResponse } from "@/core/http";
import { parse } from "@/core/validation";
import { AppErrors } from "@/core/errors";
import { rateLimit } from "@/core/rate-limit";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { bookingActionSchema, poojaBookingService } from "@/modules/poojas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const g = await requireAdmin("poojas:view");
    if (!g.ok) return jsonError(g.error);
    const r = await poojaBookingService.get((await params).id);
    if (!r.ok) return jsonError(r.error);
    return jsonOk({ booking: r.value, refund: poojaBookingService.refundSuggestion(r.value) });
  }, request);
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const parsed = parse(bookingActionSchema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const a = parsed.value;
    // Money leaving the company needs a higher permission than daily operations.
    const money = a.action === "refund" || (a.action === "cancel" && a.refundAmount > 0);
    const g = await requireAdmin(money ? "poojas:delete" : "poojas:edit");
    if (!g.ok) return jsonError(g.error);
    if (money) {
      const rl = rateLimit(`admin:pooja-refund:${g.value.session.user.id}`, { limit: 30, windowSeconds: 600 });
      if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many refunds in a short time. Try again shortly."));
    }
    return toResponse(await poojaBookingService.act((await params).id, a, { name: g.value.session.user.name }));
  }, request);
}
