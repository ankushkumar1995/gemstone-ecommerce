/**
 * /api/v1/account/push/devices
 *   POST   { token, platform, app?, appVersion?, deviceName? }  (signed-in customer) → { device }
 *          Registers this phone's Expo push token for the signed-in account. The
 *          same token under another account moves to it (shared phone).
 *   DELETE { token }  (no session needed) → { ok }
 *          Turns the token off. Used on sign-out, also after the session has
 *          already ended, so a signed-out phone stops getting the old account's alerts.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { pushService } from "@/modules/push";

export const dynamic = "force-dynamic";

const token = z.string().trim().min(10).max(200);
const reg = z.object({
  token,
  platform: z.enum(["android", "ios"]),
  app: z.string().trim().max(80).optional(),
  appVersion: z.string().trim().max(30).optional(),
  deviceName: z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  if (!rateLimit(`push:reg:${g.value.customerId}`, { limit: 20, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Please wait a moment."));
  const p = parse(reg, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await pushService.register(g.value.customerId, p.value);
  pushService.maybeSweep();
  return r.ok ? jsonOk({ device: { id: r.value.id, active: r.value.active } }) : jsonError(r.error);
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`push:unreg:${ip}`, { limit: 30, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Please wait a moment."));
  const p = parse(z.object({ token }), await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  await pushService.unregister(p.value.token);
  return jsonOk({ ok: true });
}
