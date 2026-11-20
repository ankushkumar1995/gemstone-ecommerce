/**
 * /api/v1/admin/push
 *   GET  ?status=&group=&before=   (notifications:view) → devices, last 24 h, skip reasons, recent rows
 *   POST { customerId? | phone?, title, body, url? }  (notifications:create) → send a test push
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { pushService } from "@/modules/push";

export const dynamic = "force-dynamic";

const test = z.object({
  customerId: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(20).optional(),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(200),
  url: z.string().trim().regex(/^\/(?!\/)/, "In-app path, starting with /").max(200).optional(),
}).refine((v) => v.customerId || v.phone, { message: "Give a customer id or phone number" });

export async function GET(request: NextRequest) {
  const g = await requireAdmin("notifications:view");
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  pushService.maybeSweep();
  const out = jsonOk(await pushService.adminStats({ status: sp.get("status") ?? undefined, group: sp.get("group") ?? undefined, before: sp.get("before") ?? undefined }));
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAdmin("notifications:create");
  if (!g.ok) return jsonError(g.error);
  const p = parse(test, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const r = await pushService.adminTest(p.value, who);
  return r.ok ? jsonOk(r.value) : jsonError(r.error);
}
