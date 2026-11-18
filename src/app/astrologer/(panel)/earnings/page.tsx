"use client";

/**
 * Earnings: the partner's ledger (real). Every chat, live gift, tip, refund
 * share, adjustment and payout is one row. Earnings stay on hold for the
 * dispute window, then become withdrawable on the Payouts page.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { Download, Hourglass, IndianRupee, Landmark, TrendingUp, Wallet } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatCard, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type EarningsBalance, type EarningsRules, type LedgerEntry } from "@/lib/astrologer-api";

const inr = (paise: number) => `${paise < 0 ? "−" : ""}₹${(Math.abs(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const TYPE: Record<LedgerEntry["type"], { label: string; tone: "green" | "gold" | "muted" | "rose" | "blue" | "royal" }> = {
  consultation: { label: "Chat", tone: "blue" },
  gift: { label: "Live gift", tone: "royal" },
  super_chat: { label: "Super Chat", tone: "gold" },
  tip: { label: "Tip", tone: "gold" },
  refund: { label: "Refund", tone: "rose" },
  adjustment: { label: "Adjustment", tone: "muted" },
  payout: { label: "Payout", tone: "green" },
  payout_reversal: { label: "Payout returned", tone: "muted" },
};
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" }, { key: "consultation", label: "Chats" }, { key: "gift", label: "Gifts" }, { key: "super_chat", label: "Super Chats" }, { key: "tip", label: "Tips" },
  { key: "refund", label: "Refunds" }, { key: "payout", label: "Payouts" }, { key: "adjustment", label: "Adjustments" },
];

export default function EarningsPage() {
  const { toast } = useAdminToast();
  const [balance, setBalance] = useState<EarningsBalance | null>(null);
  const [rules, setRules] = useState<EarningsRules | null>(null);
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  const load = useCallback(async (t: string, more?: string) => {
    setLoading(true);
    const r = await partnerApi.earnings.get(more, t || undefined);
    setLoading(false);
    if (!r.ok) return toast(r.message, "error");
    setBalance(r.data.balance);
    setRules(r.data.rules);
    setRows((cur) => (more ? [...cur, ...r.data.entries] : r.data.entries));
    setCursor(r.data.nextCursor);
  }, [toast]);
  useOnMount(() => { void load(""); });

  function exportCsv() {
    const lines = [["Date", "Type", "Details", "Customer paid", "Platform fee", "Amount", "Withdrawable from"], ...rows.map((e) => [when(e.at), TYPE[e.type].label, e.ref.label, (e.grossPaise / 100).toFixed(2), (e.commissionPaise / 100).toFixed(2), (e.netPaise / 100).toFixed(2), day(e.availableAt)])];
    const csv = lines.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (!balance || !rules) return <StatsSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Earnings" subtitle={`After ${rules.commissionPct}% platform commission. Tips are 100% yours. Earnings are on hold for ${rules.holdDays} days, then you can withdraw.`}
        action={<Link href="/astrologer/payouts"><AdminButton><Landmark size={15} /> Withdraw</AdminButton></Link>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} value={inr(balance.availablePaise)} label="Withdrawable now" tone="green" />
        <StatCard icon={Hourglass} value={inr(balance.onHoldPaise)} label={balance.nextReleaseAt ? `On hold · ${inr(balance.nextReleasePaise)} frees ${day(balance.nextReleaseAt)}` : "On hold"} />
        <StatCard icon={IndianRupee} value={inr(balance.inPayoutPaise)} label="In a payout" tone="royal" />
        <StatCard icon={TrendingUp} value={inr(balance.lifetimePaise)} label={`Earned all time · ${inr(balance.paidOutPaise)} paid out`} />
      </div>
      {balance.availablePaise < 0 && (
        <Card className="border-amber-300 bg-amber-50 p-4"><p className="text-sm text-amber-900">Your balance is below zero because a customer was refunded after your earnings were paid. Your next earnings cover it first.</p></Card>
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: "var(--a-border)" }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setType(f.key); void load(f.key); }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${type === f.key ? "bg-[var(--a-gold-soft)] text-[var(--a-gold)]" : "text-[var(--a-muted)] hover:bg-black/[0.04]"}`}>{f.label}</button>
          ))}
          <div className="ml-auto"><AdminButton variant="ghost" onClick={exportCsv} disabled={!rows.length}><Download size={14} /> CSV</AdminButton></div>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--a-muted)" }}>Nothing here yet. Your chats, gifts and tips appear here as they happen.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                  <th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">What</th><th className="px-4 py-2.5 text-right">Customer paid</th>
                  <th className="px-4 py-2.5 text-right">Platform fee</th><th className="px-4 py-2.5 text-right">You</th><th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const held = e.netPaise > 0 && Date.parse(e.availableAt) > now;
                  return (
                    <tr key={e.id} className="border-b" style={{ borderColor: "var(--a-border)" }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--a-muted)" }}>{when(e.at)}</td>
                      <td className="px-4 py-2.5"><Badge tone={TYPE[e.type].tone}>{TYPE[e.type].label}</Badge> <span style={{ color: "var(--a-fg)" }}>{e.ref.label}</span>{e.note && <p className="text-xs" style={{ color: "var(--a-faint)" }}>{e.note}</p>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{e.grossPaise && e.type !== "payout" && e.type !== "payout_reversal" ? inr(e.grossPaise) : ""}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--a-muted)" }}>{e.commissionPaise ? inr(e.commissionPaise) : ""}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: e.netPaise < 0 ? "#be123c" : "var(--a-fg)" }}>{e.netPaise > 0 ? "+" : ""}{inr(e.netPaise)}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: "var(--a-muted)" }}>{held ? `On hold till ${day(e.availableAt)}` : e.netPaise > 0 ? "Withdrawable" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {cursor && <div className="p-3 text-center"><AdminButton variant="outline" loading={loading} onClick={() => load(type, cursor)}>Load more</AdminButton></div>}
      </Card>
    </div>
  );
}
