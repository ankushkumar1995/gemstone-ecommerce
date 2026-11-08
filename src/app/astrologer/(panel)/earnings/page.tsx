"use client";

/**
 * Earnings (DEMO). What the partner made, how it was split, what is on hold and
 * what is payable. Same math as the live ledger: customer paid − platform fee
 * (commission %) − TDS (when enabled) = your earning. Earnings sit on hold for
 * the dispute window before they become payable.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Gift, Hourglass, IndianRupee, Landmark, Radio, ShoppingBag, TrendingUp } from "lucide-react";
import { tipsStore, useStore } from "../../_components/demo-store";
import { AdminButton, Card, Donut, LineChart, PageHeader, SegmentedControl, StatCard, StatsSkeleton } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, fmtDateTime, inr, nowMs } from "../../_components/demo";
import { GIFT_SHARE_PCT, MOCK_EARNINGS_30D, MOCK_LIVES, MOCK_REMEDY_SALES, MOCK_SESSIONS, MOCK_TIPS, TIP_SHARE_PCT } from "../../_components/mock-data";

type Period = "today" | "7d" | "30d";
const HOLD_DAYS = 7;

export default function EarningsPage() {
  const { me, loading } = usePartner();
  const [period, setPeriod] = useState<Period>("30d");
  const demoTips = useStore(tipsStore);

  const data = useMemo(() => {
    const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
    const cutoff = nowMs() - days * 86400000;
    const holdCut = nowMs() - HOLD_DAYS * 86400000;
    const done = MOCK_SESSIONS.filter((s) => s.status === "completed" && Date.parse(s.startedAt) >= cutoff);
    const gross = done.reduce((a, s) => a + s.gross, 0);
    const fee = done.reduce((a, s) => a + s.commission, 0);
    const net = done.reduce((a, s) => a + s.net, 0);
    const onHold = MOCK_SESSIONS.filter((s) => s.status === "completed" && Date.parse(s.startedAt) >= holdCut).reduce((a, s) => a + s.net, 0);
    const byChannel = (c: string) => done.filter((s) => s.channel === c).reduce((a, s) => a + s.net, 0);
    const remedy = MOCK_REMEDY_SALES.filter((r) => r.status === "delivered").reduce((a, r) => a + r.commission, 0);
    const inPeriod = (iso: string) => Date.parse(iso) >= cutoff;
    const tipsGross = [...MOCK_TIPS, ...demoTips].filter((t) => inPeriod(t.at)).reduce((a, t) => a + t.amount, 0);
    const tips = Math.round(tipsGross * TIP_SHARE_PCT) / 100;
    const lives = MOCK_LIVES.filter((l) => inPeriod(l.at));
    const giftsGross = lives.reduce((a, l) => a + l.gifts, 0);
    const gifts = Math.round(giftsGross * GIFT_SHARE_PCT) / 100;
    const liveCalls = lives.reduce((a, l) => a + l.callEarning, 0);
    return { days, gross, fee, net, onHold, payable: 18420, chat: byChannel("chat"), call: byChannel("call"), video: byChannel("video"), remedy, sessions: done.length, tipsGross, tips, giftsGross, gifts, liveCalls };
  }, [period, demoTips]);

  if (loading || !me) return <StatsSkeleton count={4} />;
  const series = MOCK_EARNINGS_30D.slice(-Math.max(2, data.days));
  const daily = MOCK_EARNINGS_30D.slice(-14).map((v, i, arr) => {
    const d = new Date(nowMs() - (arr.length - 1 - i) * 86400000);
    const gross = Math.round(v / ((100 - me.effectiveCommissionPct) / 100));
    return { day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), gross, fee: gross - v, net: v, held: i >= arr.length - HOLD_DAYS };
  }).reverse();

  const exportCsv = () => {
    const rows = [["Date", "Customer paid", "Platform fee", "You earned", "Status"], ...daily.map((d) => [d.day, d.gross, d.fee, d.net, d.held ? "On hold" : "Payable"])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "earnings-statement.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Earnings" subtitle={`Platform fee ${me.effectiveCommissionPct}% · ${HOLD_DAYS}-day hold before payout`}
        action={<div className="flex gap-2"><SegmentedControl value={period} onChange={(v: string) => setPeriod(v as Period)} options={[{ value: "today", label: "Today" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }]} /><AdminButton variant="outline" onClick={exportCsv}><Download size={15} /> Statement</AdminButton></div>} />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={IndianRupee} value={inr(Math.round(data.net))} label={`You earned (${data.sessions} sessions)`} tone="green" />
        <StatCard icon={TrendingUp} value={inr(Math.round(data.gross))} label="Customers paid" tone="royal" />
        <StatCard icon={Hourglass} value={inr(Math.round(data.onHold))} label="On hold" tone="gold" />
        <StatCard icon={Landmark} value={inr(data.payable)} label="Payable now" tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Daily earnings</p>
          <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Your share after the platform fee</p>
          <LineChart data={series} height={200} />
        </Card>
        <Card className="p-5">
          <p className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Where it came from</p>
          <Donut size={130} segments={[
            { label: "Chat", value: Math.round(data.chat), color: "#c9942a" },
            { label: "Voice call", value: Math.round(data.call), color: "#7a45f5" },
            { label: "Video call", value: Math.round(data.video), color: "#0ea5e9" },
            { label: "Remedy sales", value: Math.round(data.remedy), color: "#10b981" },
            { label: "Tips", value: Math.round(data.tips), color: "#f43f5e" },
            { label: "Live gifts + calls", value: Math.round(data.gifts + data.liveCalls), color: "#f97316" },
          ]} />
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>How this period adds up</p>
        <dl className="grid max-w-md grid-cols-2 gap-y-2 text-sm">
          <dt style={{ color: "var(--a-muted)" }}>Customers paid</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(Math.round(data.gross))}</dd>
          <dt style={{ color: "var(--a-muted)" }}>Platform fee ({me.effectiveCommissionPct}%)</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>−{inr(Math.round(data.fee))}</dd>
          <dt style={{ color: "var(--a-muted)" }}>TDS</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(0)}</dd>
          <dt style={{ color: "var(--a-muted)" }}>Refunded sessions</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(0)}</dd>
          <dt className="border-t pt-2 font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>Consultation earnings</dt><dd className="border-t pt-2 text-right font-semibold text-emerald-700" style={{ borderColor: "var(--a-border)" }}>{inr(Math.round(data.net))}</dd>
          <dt style={{ color: "var(--a-muted)" }}><ShoppingBag size={13} className="mr-1 inline" />Remedy commission</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(data.remedy)}</dd>
          <dt style={{ color: "var(--a-muted)" }}><Gift size={13} className="mr-1 inline" />Tips ({TIP_SHARE_PCT}% of {inr(data.tipsGross)})</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(data.tips)}</dd>
          <dt style={{ color: "var(--a-muted)" }}><Radio size={13} className="mr-1 inline" />Live gifts ({GIFT_SHARE_PCT}% of {inr(data.giftsGross)})</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(data.gifts)}</dd>
          <dt style={{ color: "var(--a-muted)" }}><Radio size={13} className="mr-1 inline" />Live private calls</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(data.liveCalls)}</dd>
          <dt className="border-t pt-2 font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>Total this period</dt><dd className="border-t pt-2 text-right font-semibold text-emerald-700" style={{ borderColor: "var(--a-border)" }}>{inr(Math.round((data.net + data.remedy + data.tips + data.gifts + data.liveCalls) * 100) / 100)}</dd>
        </dl>
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Gift size={16} /> Tips and gifts</p>
        <ul className="divide-y text-sm" style={{ borderColor: "var(--a-border)" }}>
          {[...demoTips, ...MOCK_TIPS].map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span style={{ color: "var(--a-fg)" }}>Tip from {t.customer}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(t.at)} · {t.sessionId}{t.note ? ` · “${t.note}”` : ""}</span></span>
              <span className="text-right"><b style={{ color: "var(--a-fg)" }}>{inr(Math.round(t.amount * TIP_SHARE_PCT) / 100)}</b><span className="block text-[11px]" style={{ color: "var(--a-faint)" }}>of {inr(t.amount)}</span></span>
            </li>
          ))}
          {MOCK_LIVES.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><span style={{ color: "var(--a-fg)" }}>Live gifts · {l.title}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(l.at)} · {l.unique.toLocaleString("en-IN")} viewers</span></span>
              <span className="text-right"><b style={{ color: "var(--a-fg)" }}>{inr(Math.round((l.gifts * GIFT_SHARE_PCT) / 100))}</b><span className="block text-[11px]" style={{ color: "var(--a-faint)" }}>of {inr(l.gifts)}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>A refunded session also refunds its tip. Tips and gifts follow the same hold period as sessions.</p>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Last 14 days</p>
          <Link href="/astrologer/payouts" className="text-sm font-medium" style={{ color: "var(--a-gold)" }}>Go to payouts</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Date</th><th className="text-right font-medium">Customers paid</th><th className="text-right font-medium">Platform fee</th><th className="text-right font-medium">You earned</th><th className="pl-4 font-medium">Status</th></tr></thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="py-2">{d.day}</td><td className="text-right tabular-nums">{inr(d.gross)}</td><td className="text-right tabular-nums">−{inr(d.fee)}</td><td className="text-right font-medium tabular-nums">{inr(d.net)}</td>
                  <td className="pl-4 text-xs" style={{ color: d.held ? "var(--a-gold)" : "var(--a-green, #047857)" }}>{d.held ? "On hold" : "Payable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
