/**
 * /api/v1/account/push/prefs  (signed-in customer)
 *   GET                                   → { prefs }
 *   PUT { groups?: {live,reminders,chat,wallet,orders}, quiet?: { enabled, start, end } } → { prefs }
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer } from "@/modules/customer-auth";
import { pushService } from "@/modules/push";

export const dynamic = "force-dynamic";

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const schema = z.object({
  groups: z.object({ live: z.boolean(), reminders: z.boolean(), chat: z.boolean(), wallet: z.boolean(), orders: z.boolean() }).partial().optional(),
  quiet: z.object({ enabled: z.boolean(), start: hm, end: hm }).partial().optional(),
});

export async function GET() {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const out = jsonOk({ prefs: await pushService.prefs(g.value.customerId) });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function PUT(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const r = await pushService.setPrefs(g.value.customerId, p.value);
  return r.ok ? jsonOk({ prefs: r.value }) : jsonError(r.error);
}
