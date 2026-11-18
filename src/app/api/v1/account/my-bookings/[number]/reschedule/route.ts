/**
 * POST /api/v1/account/my-bookings/:number/reschedule  (customer, guarded; app + website)
 *   { date: "YYYY-MM-DD", time: "HH:MM" | "any" } → { booking }
 *
 * Moves a pooja / havan booking to another open date inside the free
 * reschedule window (policy snapshotted on the booking). The new seat is
 * reserved before the old one is released, so it can never be lost.
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
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^(any|([01]\d|2[0-3]):[0-5]\d)$/, "Pick a time"),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:booking-move:${guard.value.customerId}`, { limit: 10, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please try again in a few minutes."));
  const { number } = await ctx.params;
  if (!/^[A-Z0-9-]{4,40}$/i.test(number)) return jsonError(AppErrors.notFound("Booking not found"));
  const parsed = parse(schema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);
  const res = await myBookingsService.reschedule(guard.value.customerId, number, parsed.value.date, parsed.value.time);
  if (!res.ok) return jsonError(res.error);
  const out = jsonOk(res.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
