/**
 * GET /api/v1/astrologer/earnings?cursor=&type=  (approved astrologer)
 *   → { balance, entries, nextCursor, rules, tds }  balance, ledger rows (newest first),
 *     payout rules and the TDS summary by financial year.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { requireAstrologer } from "@/modules/astrologer-auth";
import { earningsService, maybeRunEarningsJobs, type LedgerType } from "@/modules/earnings";

export const dynamic = "force-dynamic";
const TYPES: LedgerType[] = ["consultation", "gift", "super_chat", "tip", "remedy", "remedy_reversal", "refund", "adjustment", "payout", "payout_reversal"];

export async function GET(request: NextRequest) {
  const g = await requireAstrologer({ approved: true });
  if (!g.ok) return jsonError(g.error);
  maybeRunEarningsJobs();
  const id = g.value.astrologer.id;
  const sp = request.nextUrl.searchParams;
  const t = sp.get("type") as LedgerType | null;
  const [balance, page, rules, tds] = await Promise.all([
    earningsService.balance(id),
    earningsService.entries(id, { cursor: sp.get("cursor") ?? undefined, type: t && TYPES.includes(t) ? t : undefined }),
    earningsService.rules(),
    earningsService.tdsSummary(id),
  ]);
  const out = jsonOk({ balance, entries: page.items, nextCursor: page.nextCursor, rules, tds });
  out.headers.set("Cache-Control", "private, no-store");
  return out;
}
