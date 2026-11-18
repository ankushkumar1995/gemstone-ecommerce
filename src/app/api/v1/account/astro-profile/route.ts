/**
 * /api/v1/account/astro-profile  (customer, guarded; website + app)
 *   GET → { profile }  primary birth details, or null if not set yet
 *   PUT → { profile }  create or replace them (idempotent)
 * The customerId comes from the session, never the body.
 */

import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { AppErrors } from "@/core/errors";
import { requireCustomer } from "@/modules/customer-auth";
import { astroProfileSchema, astroProfileService } from "@/modules/astro-profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const res = await astroProfileService.getPrimary(guard.value.customerId);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ profile: res.value });
}

export async function PUT(request: NextRequest) {
  const guard = await requireCustomer();
  if (!guard.ok) return jsonError(guard.error);
  const rl = rateLimit(`account:astro-profile:${guard.value.customerId}`, { limit: 30, windowSeconds: 3600 });
  if (!rl.allowed) return jsonError(AppErrors.rateLimited("Too many updates. Please try again later."));

  const parsed = parse(astroProfileSchema, await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error);

  const raw = (request.headers.get("x-client") ?? "").toLowerCase();
  const source = raw === "android" || raw === "ios" ? raw : "web";
  const res = await astroProfileService.savePrimary(guard.value.customerId, parsed.value, source);
  if (!res.ok) return jsonError(res.error);
  return jsonOk({ profile: res.value });
}
