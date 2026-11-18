/**
 * /api/v1/admin/earnings  (admin)
 *   GET                         → { balances }  every astrologer with money in the ledger
 *   GET ?astrologerId=&cursor=  → { balance, entries, nextCursor, payouts, tds }
 *   POST { action: "adjust", astrologerId, amountPaise (±), reason, requestId }
 *   POST { action: "reconcile" }   add any missing ledger rows (chats, refunds, gifts)
 *   POST { action: "run_weekly" }  create this week's payout requests now
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { parse } from "@/core/validation";
import { requireAdmin } from "@/modules/admin-auth/guard";
import { auditService } from "@/modules/audit";
import { earningsService } from "@/modules/earnings";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("adjust"), astrologerId: z.string().regex(/^[a-f0-9]{24}$/i), amountPaise: z.number().int(), reason: z.string().trim().min(5).max(300), requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/) }),
  z.object({ action: z.literal("reconcile") }),
  z.object({ action: z.literal("run_weekly") }),
]);

export async function GET(request: NextRequest) {
  const g = await requireAdmin("payouts:view");
  if (!g.ok) return jsonError(g.error);
  const sp = request.nextUrl.searchParams;
  const aid = sp.get("astrologerId");
  if (!aid) {
    const out = jsonOk({ balances: await earningsService.adminBalances() });
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  }
  const [balance, page, payouts, tds] = await Promise.all([
    earningsService.balance(aid),
    earningsService.entries(aid, { cursor: sp.get("cursor") ?? undefined, limit: 50 }),
    earningsService.adminList({ status: "all", astrologerId: aid }),
    earningsService.tdsSummary(aid),
  ]);
  const out = jsonOk({ balance, entries: page.items, nextCursor: page.nextCursor, payouts, tds });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}

export async function POST(request: NextRequest) {
  const g = await requireAdmin("payouts:edit");
  if (!g.ok) return jsonError(g.error);
  const p = parse(schema, await request.json().catch(() => null));
  if (!p.ok) return jsonError(p.error);
  const who = g.value.session.user.name || g.value.session.user.email || "Admin";
  const v = p.value;
  if (v.action === "adjust") {
    const r = await earningsService.adjust(v.astrologerId, v.amountPaise, v.reason, v.requestId, who);
    return r.ok ? jsonOk({ balance: r.value }) : jsonError(r.error);
  }
  if (v.action === "reconcile") {
    const res = await earningsService.reconcile();
    await auditService.record({ action: "update", entity: "payout", summary: `Reconciled earnings ledger: ${res.consultations} chats, ${res.refunds} refunds, ${res.gifts} gifts added`, actor: who }).catch(() => undefined);
    return jsonOk(res);
  }
  const res = await earningsService.runWeekly(true);
  await auditService.record({ action: "create", entity: "payout", summary: res.ran ? `Ran payout cycle: ${res.created} payouts created, ${res.skipped} skipped` : `Payout cycle already ran today (${res.date})`, actor: who }).catch(() => undefined);
  return jsonOk(res);
}
