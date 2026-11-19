/**
 * /api/v1/account/referral  (signed-in customer)
 *   GET               → { referral }  my code, rules, friends who joined, the code I used
 *   POST { code }     → { referral }  enter a friend's code (new customers only; bonus after the first qualifying recharge)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { clientIp, rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { referralService } from "@/modules/referrals";

export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().trim().min(4, "Enter the code").max(20) });

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const r = await referralService.mine(g.value.customerId);
  if (!r.ok) return jsonError(r.error);
  const out = jsonOk({ referral: r.value });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const ip = clientIp(request.headers);
  // Stops guessing codes: few tries per account and per network.
  if (!rateLimit(`referral:apply:${g.value.customerId}`, { limit: 8, windowSeconds: 3600 }).allowed || !rateLimit(`referral:apply-ip:${ip}`, { limit: 30, windowSeconds: 3600 }).allowed) {
    return jsonError(AppErrors.rateLimited("Too many tries. Please try again in an hour."));
  }
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await referralService.apply(g.value.customerId, p.value.code, { ip });
  return r.ok ? jsonOk({ referral: r.value }) : jsonError(r.error);
}
