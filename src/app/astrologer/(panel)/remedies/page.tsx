"use client";

/**
 * Remedy sales. Sales made from products and poojas the partner suggested in
 * chats, the commission on each and where it stands. Commission is confirmed
 * only after delivery (or the pooja) and the return window; cancels and
 * refunds reverse it. Rules come from program settings (admin).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Gem, RotateCcw, ShoppingBag, Sparkles } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatCard, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { partnerApi, type RemedyPartnerView, type RemedySale } from "@/lib/astrologer-api";

type Tab = "all" | "waiting" | "in_window" | "confirmed" | "reversed";
const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STAGE: Record<RemedySale["stage"], { tone: "green" | "gold" | "muted" | "rose" | "blue"; label: string }> = {
  waiting: { tone: "blue", label: "Waiting for delivery" },
  in_window: { tone: "gold", label: "In return window" },
  confirmed: { tone: "green", label: "Earned" },
  reversed: { tone: "rose", label: "Reversed" },
};

export default function RemediesPage() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("all");
  const [data, setData] = useState<RemedyPartnerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => { const t = setTimeout(() => setNow(Date.now()), 0); return () => clearTimeout(t); }, []);

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const r = await partnerApi.remedies.summary(tab === "all" ? undefined : tab, before);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setData((cur) => (before && cur ? { ...r.data, items: [...cur.items, ...r.data.items] } : r.data));
  }, [tab, toast]);

  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  if (!data) return <StatsSkeleton count={4} />;
  const { rules, stats } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Remedy sales" subtitle="Earn a commission when customers buy what you suggest in a chat" />

      {!rules.enabled && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Remedy suggestions are paused by AstroUnkle right now. Sales already made still count.</Card>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={ShoppingBag} value={stats.sales} label={`Sales from ${stats.suggestions} suggestions`} tone="royal" />
        <StatCard icon={CheckCircle2} value={inr(stats.confirmedPaise)} label="Commission earned" tone="green" />
        <StatCard icon={Clock} value={inr(stats.pendingPaise)} label="Pending (not final yet)" tone="gold" />
        <StatCard icon={RotateCcw} value={inr(stats.reversedPaise)} label="Reversed" tone="rose" />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="flex-1 font-semibold" style={{ color: "var(--a-fg)" }}>Sales</p>
          <Tabs<Tab> variant="pills" value={tab} onChange={(t) => { setData((d) => (d ? { ...d, items: [] } : d)); setTab(t); }} tabs={[
            { value: "all", label: "All" }, { value: "waiting", label: "Waiting" }, { value: "in_window", label: "Return window" },
            { value: "confirmed", label: "Earned" }, { value: "reversed", label: "Reversed" },
          ]} />
        </div>
        {data.items.length === 0 ? (
          <div className="py-10 text-center">
            <Sparkles size={26} className="mx-auto" style={{ color: "var(--a-faint)" }} />
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>{tab === "all" ? "No sales yet" : "Nothing here"}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>In a live chat, tap the ✦ button next to Send to suggest a product or pooja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}>
                <th className="py-2 font-medium">Item</th><th className="font-medium">Customer</th><th className="text-right font-medium">Paid</th>
                <th className="text-right font-medium">Commission</th><th className="pl-4 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="border-t align-top" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                    <td className="py-2.5">
                      <span className="font-medium">{s.itemName}</span>{s.qty > 1 ? <span style={{ color: "var(--a-muted)" }}> × {s.qty}</span> : null}
                      <span className="block text-xs" style={{ color: "var(--a-muted)" }}>{s.source.kind === "order" ? "Order" : "Booking"} {s.source.number} · {when(s.boughtAt)}</span>
                      <span className="block text-xs" style={{ color: "var(--a-faint)" }}>Suggested in chat {s.sessionNumber}</span>
                    </td>
                    <td>{s.customerName}</td>
                    <td className="text-right tabular-nums">{inr(s.basePaise)}</td>
                    <td className="text-right font-medium tabular-nums">{inr(s.commissionPaise)}<span className="block text-xs font-normal" style={{ color: "var(--a-muted)" }}>{s.commissionPct}%</span></td>
                    <td className="pl-4">
                      <Badge tone={STAGE[s.stage].tone}>{STAGE[s.stage].label}</Badge>
                      <span className="mt-1 block text-xs" style={{ color: "var(--a-muted)" }}>
                        {s.stage === "in_window" ? `Final on ${day(s.confirmAt)}` : s.stage === "confirmed" ? `Added ${day(s.confirmedAt)}` : s.stage === "reversed" ? s.reason : s.source.kind === "order" ? "Counts after delivery" : "Counts after the pooja"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.nextBefore && <div className="pt-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(data.nextBefore!)}>Load more</AdminButton></div>}
          </div>
        )}
      </Card>

      {data.recent.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Your recent suggestions</p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: "var(--a-gold-soft)" }}>
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" className="h-full w-full object-cover" />
                  ) : s.kind === "pooja" ? <Sparkles size={16} style={{ color: "var(--a-gold)" }} /> : <Gem size={16} style={{ color: "var(--a-gold)" }} />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{s.name}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>To {s.customerName} · {day(s.at)}</p>
                  <p className="text-xs" style={{ color: s.sales ? "#047857" : "var(--a-faint)" }}>{s.sales ? `Bought (${s.sales})` : now && Date.parse(s.expiresAt) > now ? `Counts until ${day(s.expiresAt)}` : "Not bought"}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>How it works</p>
        <ul className="list-disc space-y-1 pl-5" style={{ color: "var(--a-muted)" }}>
          <li>In a live chat, tap ✦ next to Send and pick a shop product{rules.allowPoojas ? " or a pooja" : ""}. The customer gets a card with one-tap buy.</li>
          <li>You earn {rules.commissionPct}% of what the customer pays for that item (after discount, without shipping){rules.maxCommissionPaise ? `, up to ${inr(rules.maxCommissionPaise)} per sale` : ""}, if they buy it within {rules.attributionDays} days. The % is fixed when you send the card.</li>
          <li>If two astrologers suggest the same item, the latest suggestion before the purchase gets the commission.</li>
          <li>Commission becomes final {rules.confirmAfterDays} days after delivery (or after the pooja). Cancels and refunds reverse it, even after it was added.</li>
          <li>Up to {rules.maxPerChat} suggestions in one chat. Suggest only what truly fits the chart. Never pressure or scare a customer, and never promise guaranteed results.</li>
          <li>Only items in the AstroUnkle shop count. Selling outside the platform leads to suspension. See your <Link href="/astrologer/earnings" style={{ color: "var(--a-gold)" }}>earnings</Link>.</li>
        </ul>
      </Card>
    </div>
  );
}
