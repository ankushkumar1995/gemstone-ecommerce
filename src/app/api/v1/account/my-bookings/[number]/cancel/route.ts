/**
 * POST /api/v1/account/my-bookings/:number/cancel  (customer, guarded; app + website)
 *   { refundTo: "source" | "wallet", requestId } → { booking }
 *
 * The customer cancels their own pooja / havan or service booking. The server
 * re-checks the policy (refund tiers for poojas; services only before the
 * session is scheduled) and refunds exactly once. Retrying with the same
 * requestId is safe.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { myBookingsService } from "@/modules/my-bookings";

export const dynamic = "force-dynamic";

const schema = z.object({
  refundTo: z.enum(["source", "wallet"]).default("source"),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:booking-cancel:${guard.value.customerId}`, { limit: 10, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please try again in a few minutes."));
  const { number } = await ctx.params;
  if (!/^[A-Z0-9-]{4,40}$/i.test(number)) return jsonError(AppErrors.notFound("Booking not found"));
  const parsed = parse(schema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const res = await myBookingsService.cancel(guard.value.customerId, number, parsed.value.refundTo, parsed.value.requestId);
  if (!res.ok) return jsonError(res.error);
  const out = jsonOk(res.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
