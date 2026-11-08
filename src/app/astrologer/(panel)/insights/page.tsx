"use client";

/**
 * Profile insights (DEMO). The funnel from being seen to being paid, where
 * views come from, why your ranking moved (each factor with its effect),
 * demand vs your online time, and how your price compares.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, IndianRupee, MousePointerClick, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Card, Donut, LineChart, PageHeader, SegmentedControl, StatCard, StatsSkeleton } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner } from "../../_components/demo";
import { MOCK_DEMAND, MOCK_FUNNEL_30D, MOCK_RANK_FACTORS, MOCK_VIEW_SOURCES } from "../../_components/mock-data";

type Period = "7" | "30";
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export default function InsightsPage() {
  const { me, loading } = usePartner();
  const [period, setPeriod] = useState<Period>("7");

  const f = useMemo(() => {
    const days = Number(period);
    const cur = MOCK_FUNNEL_30D.slice(-days);
    const prev = MOCK_FUNNEL_30D.slice(-days * 2, -days);
    const sum = (rows: typeof cur) => rows.reduce((a, r) => ({ impressions: a.impressions + r.impressions, views: a.views + r.views, clicks: a.clicks + r.clicks, started: a.started + r.started, paid: a.paid + r.paid }), { impressions: 0, views: 0, clicks: 0, started: 0, paid: 0 });
    return { cur: sum(cur), prev: prev.length ? sum(prev) : null, series: cur.map((r) => r.views) };
  }, [period]);

  if (loading || !me) return <StatsSkeleton count={4} />;
  const c = f.cur;
  const conv = pctOf(c.paid, c.views);
  const prevConv = f.prev ? pctOf(f.prev.paid, f.prev.views) : null;
  const net = MOCK_RANK_FACTORS.reduce((a, r) => a + r.impact, 0);
  const steps = [
    { label: "Seen in lists", value: c.impressions, icon: Search, note: "Shown in search, category or online lists" },
    { label: "Opened your profile", value: c.views, icon: Eye, note: `${pctOf(c.views, c.impressions)}% of people who saw you` },
    { label: "Tapped chat or call", value: c.clicks, icon: MousePointerClick, note: `${pctOf(c.clicks, c.views)}% of profile visitors` },
    { label: "Session started", value: c.started, icon: Wallet, note: `${pctOf(c.started, c.clicks)}% (others had low balance or you were busy)` },
    { label: "Paid session", value: c.paid, icon: IndianRupee, note: `${pctOf(c.paid, c.started)}% lasted past the free minutes` },
  ];
  const chatRate = me.rates.chat;
  const MEDIAN = 22;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile insights" subtitle="How people find you and what makes them book"
        action={<SegmentedControl value={period} onChange={(v: string) => setPeriod(v as Period)} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />} />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Eye} value={c.views.toLocaleString("en-IN")} label="Profile views" tone="blue" />
        <StatCard icon={MousePointerClick} value={`${conv}%`} label="Views to paid sessions" tone="green" change={prevConv !== null ? `${conv >= prevConv ? "+" : ""}${Math.round((conv - prevConv) * 10) / 10} pts` : undefined} trend={prevConv !== null ? (conv >= prevConv ? "up" : "down") : undefined} />
        <StatCard icon={net >= 0 ? TrendingUp : TrendingDown} value={`#42`} label={`Category rank (${net >= 0 ? "up" : "down"} ${Math.abs(net)} this week)`} tone={net >= 0 ? "green" : "rose"} />
        <StatCard icon={IndianRupee} value={`₹${chatRate || "–"}`} label={`Your chat rate (median ₹${MEDIAN})`} tone="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <p className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Your funnel</p>
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const w = Math.max(6, (s.value / steps[0].value) * 100);
              return (
                <li key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="flex items-center gap-2" style={{ color: "var(--a-fg)" }}><s.icon size={15} style={{ color: "var(--a-gold)" }} />{s.label}</span><b style={{ color: "var(--a-fg)" }}>{s.value.toLocaleString("en-IN")}</b></div>
                  <div className="h-2.5 rounded-full" style={{ background: "var(--a-surface-2)" }}><div className="h-full rounded-full bg-gradient-to-r from-[#e6b43a] to-[#c9942a]" style={{ width: `${w}%` }} /></div>
                  {i > 0 && <p className="mt-0.5 text-xs" style={{ color: "var(--a-muted)" }}>{s.note}</p>}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
            Biggest drop: <b>profile view to tap</b> ({pctOf(c.clicks, c.views)}%). Profiles with a clear photo, 3+ languages and a bio over 300 characters convert about 40% better.
          </p>
        </Card>
        <Card className="p-5">
          <p className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Where views come from</p>
          <Donut size={120} segments={MOCK_VIEW_SOURCES} />
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Profile views per day</p>
        <LineChart data={f.series} height={150} />
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Why your ranking changed this week</p>
          <span className={`flex items-center gap-1 text-sm font-semibold ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{net >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{Math.abs(net)} places</span>
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {[...MOCK_RANK_FACTORS].sort((a, b) => a.impact - b.impact).map((r) => (
            <li key={r.factor} className="flex flex-wrap items-start gap-3 py-3 text-sm">
              <span className={`w-14 shrink-0 text-right font-semibold tabular-nums ${r.impact >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.impact > 0 ? `+${r.impact}` : r.impact}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium" style={{ color: "var(--a-fg)" }}>{r.factor}</span> <span style={{ color: "var(--a-muted)" }}>{r.from} → {r.to}</span>
                <span className="block text-xs" style={{ color: "var(--a-muted)" }}>{r.tip}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>Ranking uses only these signals. It cannot be bought, and the admin cannot boost one partner without it being logged.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Demand vs your online time</p>
          <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Gold: customer demand in your category. Grey: how much of that time you were online.</p>
          <ul className="space-y-2.5">
            {MOCK_DEMAND.map((d) => (
              <li key={d.part} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-xs">
                <span style={{ color: "var(--a-muted)" }}>{d.part}</span>
                <span className="space-y-1">
                  <span className="block h-2 rounded-full bg-[#e6b43a]" style={{ width: `${d.demand}%` }} aria-label={`Demand ${d.demand}`} />
                  <span className="block h-2 rounded-full bg-slate-400" style={{ width: `${d.you}%` }} aria-label={`You online ${d.you}%`} />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm" style={{ color: "var(--a-fg)" }}>You miss most demand between <b>6 and 9 pm</b>. Being online then could add about 30% more sessions.</p>
        </Card>
        <Card className="p-5">
          <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Price check (chat, similar experience)</p>
          <div className="relative mt-6 h-2 rounded-full" style={{ background: "var(--a-surface-2)" }}>
            {[{ v: 12, l: "Low ₹12" }, { v: MEDIAN, l: `Median ₹${MEDIAN}` }, { v: 40, l: "Top 10% ₹40" }].map((m) => (
              <span key={m.l} className="absolute -top-6 -translate-x-1/2 text-[11px]" style={{ left: `${(m.v / 50) * 100}%`, color: "var(--a-muted)" }}>{m.l}</span>
            ))}
            {chatRate > 0 && <span className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#c9942a] shadow" style={{ left: `${Math.min(100, (chatRate / 50) * 100)}%` }} aria-label={`Your rate ₹${chatRate}`} />}
          </div>
          <p className="mt-5 text-sm" style={{ color: "var(--a-fg)" }}>
            {chatRate === 0 ? "Set a chat rate in Profile & rates to compare." : chatRate > MEDIAN * 1.3 ? "You are priced well above similar partners. That is fine if your rating and repeat rate are high; otherwise views convert less." : chatRate < MEDIAN * 0.7 ? "You are priced below similar partners. You could raise your rate a little without losing many customers." : "Your rate is close to similar partners."}
          </p>
        </Card>
      </div>
    </div>
  );
}
