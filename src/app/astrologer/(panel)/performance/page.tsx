"use client";

/**
 * Performance (DEMO). The same quality signals the admin uses for ranking and
 * tiers, shown openly to the partner with targets and plain tips. Tier rules
 * are transparent: what you need for the next tier and what it unlocks.
 */

import { Award, CheckCircle2, Clock, Gauge, MessageCircle, Repeat2, ShieldAlert, Star, Timer, TrendingUp, XCircle } from "lucide-react";
import { BarChart, Card, PageHeader, ProgressBar, StatsSkeleton } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner } from "../../_components/demo";

interface Kpi { label: string; value: number; unit: string; target: number; better: "higher" | "lower"; icon: typeof Gauge; tip: string }

const KPIS: Kpi[] = [
  { label: "Acceptance rate", value: 91, unit: "%", target: 90, better: "higher", icon: CheckCircle2, tip: "Turn on sound and desktop alerts so no request is missed." },
  { label: "First reply time", value: 38, unit: "sec", target: 30, better: "lower", icon: Timer, tip: "Use a quick reply to greet the customer the moment the chat opens." },
  { label: "Average rating", value: 4.6, unit: "/5", target: 4.5, better: "higher", icon: Star, tip: "Summarise the remedy at the end of each chat. Customers rate clear answers higher." },
  { label: "Repeat customers", value: 34, unit: "%", target: 30, better: "higher", icon: Repeat2, tip: "Add a private note after each session so you remember them next time." },
  { label: "Avg session length", value: 11.4, unit: "min", target: 8, better: "higher", icon: MessageCircle, tip: "Ask for birth details early so the reading starts quickly." },
  { label: "Missed requests (7 days)", value: 4, unit: "", target: 3, better: "lower", icon: XCircle, tip: "Go offline when you step away instead of leaving requests unanswered." },
  { label: "Complaints (30 days)", value: 1, unit: "", target: 2, better: "lower", icon: ShieldAlert, tip: "Stay polite even with difficult customers. You can end abusive chats and report them." },
  { label: "Online hours this week", value: 26, unit: "h", target: 30, better: "higher", icon: Clock, tip: "Evenings 6 to 11 pm get the most requests." },
];

const TIERS = [
  { name: "Rising", fee: 40, need: "Approved profile" },
  { name: "Silver", fee: 38, need: "4.3+ rating, 200 sessions, 85% acceptance" },
  { name: "Gold", fee: 35, need: "4.5+ rating, 1,000 sessions, 90% acceptance" },
  { name: "Platinum", fee: 30, need: "4.7+ rating, 5,000 sessions, 95% acceptance, no strikes" },
];

const ok = (k: Kpi) => (k.better === "higher" ? k.value >= k.target : k.value <= k.target);

export default function PerformancePage() {
  const { me, loading } = usePartner();
  if (loading || !me) return <StatsSkeleton count={4} />;
  const score = Math.round((KPIS.filter(ok).length / KPIS.length) * 100);
  const tierIdx = 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" subtitle="How customers and the ranking see you" />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(#c9942a ${score * 3.6}deg, var(--a-surface-2) 0deg)` }} role="img" aria-label={`Quality score ${score} out of 100`}>
              <div className="flex flex-col items-center justify-center rounded-full" style={{ background: "var(--a-surface)", width: 88, height: 88 }}>
                <span className="text-2xl font-bold" style={{ color: "var(--a-fg)" }}>{score}</span>
                <span className="text-[10px]" style={{ color: "var(--a-muted)" }}>quality score</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="font-semibold" style={{ color: "var(--a-fg)" }}>You rank #42 of 318 in Vedic astrology</p>
              <p style={{ color: "var(--a-muted)" }}>Ranking uses rating, acceptance, reply time, repeat customers and complaints. Paid boosts do not exist.</p>
              <p className="flex items-center gap-1 font-medium text-emerald-700"><TrendingUp size={14} /> Up 9 places this week</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Online hours, last 7 days</p>
          <BarChart height={120} data={[{ label: "Fri", value: 3 }, { label: "Sat", value: 6 }, { label: "Sun", value: 1 }, { label: "Mon", value: 5 }, { label: "Tue", value: 4 }, { label: "Wed", value: 3 }, { label: "Thu", value: 4 }]} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {KPIS.map((k) => {
          const good = ok(k);
          const I = k.icon;
          const pct = k.better === "higher" ? Math.min(100, (k.value / (k.target * 1.25)) * 100) : Math.min(100, (k.target / Math.max(k.value, 0.01)) * 80);
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center gap-3">
                <I size={18} style={{ color: good ? "var(--a-green, #047857)" : "#be123c" }} />
                <p className="flex-1 text-sm font-medium" style={{ color: "var(--a-fg)" }}>{k.label}</p>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--a-fg)" }}>{k.value}{k.unit}</p>
              </div>
              <div className="mt-2"><ProgressBar value={pct} tone={good ? "green" : "rose"} /></div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--a-muted)" }}>Target {k.better === "higher" ? "at least" : "at most"} {k.target}{k.unit}. {good ? "On track." : k.tip}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <p className="mb-4 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Award size={16} /> Partner tiers</p>
        <ol className="grid gap-3 md:grid-cols-4">
          {TIERS.map((t, i) => (
            <li key={t.name} className="rounded-lg border p-3" style={{ borderColor: i === tierIdx ? "var(--a-gold)" : "var(--a-border)", background: i === tierIdx ? "var(--a-gold-soft)" : undefined }}>
              <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{t.name} {i === tierIdx && <span className="text-xs" style={{ color: "var(--a-gold)" }}>· you</span>}</p>
              <p className="text-sm" style={{ color: "var(--a-fg)" }}>Platform fee {t.fee}%</p>
              <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{t.need}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Tiers are reviewed on the 1st of every month. Your fee today is {me.effectiveCommissionPct}% (set by the admin for your account).</p>
      </Card>
    </div>
  );
}
