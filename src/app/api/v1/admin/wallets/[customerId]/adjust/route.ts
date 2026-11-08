/**
 * POST /api/v1/admin/wallets/:customerId/adjust
 *   { bucket, direction, amount (₹, up to 2 decimals), reason, requestId }
 * Manual credit/debit. Needs wallets:edit, a reason, and a client requestId so a
 * double click or retry is applied only once. Every adjustment is audited.
 */
import type { NextRequest } from "next/server";
import { handle, jsonError, toResponse } from "@/core/http";
import { parse, z } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { AppErrors } from "@/core/errors";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { body } from "@/modules/astrologer-auth/http";
import { customerService } from "@/modules/customers";
import { walletService, toPaise } from "@/modules/wallets";

export const dynamic = "force-dynamic";

const schema = z.object({
  bucket: z.enum(["cash", "promo"]),
  direction: z.enum(["credit", "debit"]),
  amount: z.number().positive().max(100_000).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most 2 decimals"),
  reason: z.string().trim().min(5).max(250),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Invalid request id"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  return handle(async () => {
    const g = await requireAdmin("wallets:edit");
    if (!g.ok) return jsonError(g.error);
    const rl = rateLimit(`admin:wallet-adjust:${g.value.session.user.id}`, { limit: 30, windowSeconds: 10 * 60 });
    if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many adjustments. Try again shortly."));
    const parsed = parse(schema, await body(request));
    if (!parsed.ok) return jsonError(parsed.error);
    const { customerId } = await params;
    const c = await customerService.getById(customerId);
    if (!c.ok) return jsonError(c.error);
    return toResponse(await walletService.adjust({
      customerId, bucket: parsed.value.bucket, direction: parsed.value.direction, amountPaise: toPaise(parsed.value.amount),
      reason: parsed.value.reason, requestId: parsed.value.requestId, adminName: g.value.session.user.name,
      customerLabel: `${c.value.name} (${c.value.email})`,
    }));
  }, request);
}
