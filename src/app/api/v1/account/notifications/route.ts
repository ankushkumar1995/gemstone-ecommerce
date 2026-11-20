/**
 * /api/v1/account/notifications  (signed-in customer) — the in-app inbox
 *   GET  ?before=<at>                       → { items, unread, nextBefore }
 *   POST { ids: string[] } | { all: true }  → { unread }   mark read
 *   POST { opened: pushId }                 → { unread }   the customer tapped a push
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireCustomer } from "@/modules/customer-auth";
import { pushService } from "@/modules/push";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ ids: z.array(z.string().max(40)).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
  z.object({ opened: z.string().max(40) }),
]);

export async function GET(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  pushService.maybeSweep();
  const out = jsonOk(await pushService.inbox(g.value.customerId, request.nextUrl.searchParams.get("before") ?? undefined));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const v = p.value;
  if ("opened" in v) {
    await pushService.opened(g.value.customerId, v.opened);
    return jsonOk({ unread: (await pushService.inbox(g.value.customerId)).unread });
  }
  return jsonOk(await pushService.markRead(g.value.customerId, "all" in v ? "all" : v.ids));
}
