/**
 * POST /api/v1/account/my-orders/:number/cancel  (customer, guarded; app)
 *   { refundTo: "source" | "wallet" } → { order }
 * Before it is packed only. Stock goes back; a paid order is refunded in full, once.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { myOrdersService } from "@/modules/orders/my-orders";

export const dynamic = "force-dynamic";
const schema = z.object({ refundTo: z.enum(["source", "wallet"]).default("source") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:order-cancel:${guard.value.customerId}`, { limit: 10, windowSeconds: 10 * 60 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many attempts. Please try again in a few minutes."));
  const { number } = await params;
  if (!/^[A-Z0-9-]{4,40}$/i.test(number)) return jsonError(AppErrors.notFound("Order not found"));
  const parsed = parse(schema, await request.json().catch(() => ({})));
  if (!parsed.ok) return jsonError(parsed.error);
  const r = await myOrdersService.cancel(guard.value.customerId, number, parsed.value.refundTo);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk(r.value);
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
