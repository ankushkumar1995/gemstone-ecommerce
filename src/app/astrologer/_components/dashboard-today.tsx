"use client";

/**
 * Dashboard "today" block (DEMO data): today's numbers, announcements from the
 * admin, the next appointments, latest reviews and quick links.
 */

import Link from "next/link";
import { BellRing, CalendarDays, Clock, IndianRupee, Landmark, Megaphone, MessageCircle, Star } from "lucide-react";
import { Card, LineChart, StatCard } from "@/app/admin/_components";
import { CHANNEL_LABEL, DemoBanner, Stars, fmtDateTime, inr, timeAgo } from "./demo";
import { MOCK_ANNOUNCEMENTS, MOCK_APPOINTMENTS, MOCK_EARNINGS_30D, MOCK_REVIEWS } from "./mock-data";

export function DashboardToday() {
  const today = MOCK_EARNINGS_30D[MOCK_EARNINGS_30D.length - 1];
  const week = MOCK_EARNINGS_30D.slice(-7).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      <DemoBanner what="The numbers below" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={IndianRupee} value={inr(today)} label="Earned today" tone="green" />
        <StatCard icon={MessageCircle} value={7} label="Sessions today" tone="royal" />
        <StatCard icon={Clock} value="3h 40m" label="Online today" tone="blue" />
        <StatCard icon={Landmark} value={inr(18420)} label="Next payout" tone="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Last 7 days · {inr(week)}</p>
            <Link href="/astrologer/earnings" className="text-sm font-medium" style={{ color: "var(--a-gold)" }}>Earnings</Link>
          </div>
          <LineChart data={MOCK_EARNINGS_30D.slice(-7)} height={150} />
        </Card>
        <Card className="space-y-2 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Quick links</p>
          {[
            { href: "/astrologer/requests", icon: BellRing, label: "Live requests" },
            { href: "/astrologer/schedule", icon: CalendarDays, label: "Set working hours" },
            { href: "/astrologer/reviews", icon: Star, label: "Reply to reviews" },
            { href: "/astrologer/payouts", icon: Landmark, label: "Payouts" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-black/[0.03]" style={{ color: "var(--a-fg)" }}><l.icon size={16} style={{ color: "var(--a-gold)" }} />{l.label}</Link>
          ))}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Megaphone size={16} /> From Astrounkle</p>
          <ul className="space-y-3">{MOCK_ANNOUNCEMENTS.map((a) => <li key={a.id} className="text-sm"><p className="font-medium" style={{ color: "var(--a-fg)" }}>{a.title}</p><p style={{ color: "var(--a-muted)" }}>{a.body}</p><p className="text-xs" style={{ color: "var(--a-faint)" }}>{timeAgo(a.at)}</p></li>)}</ul>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarDays size={16} /> Next appointments</p>
          <ul className="space-y-2">{MOCK_APPOINTMENTS.slice(0, 3).map((a) => <li key={a.id} className="text-sm"><p style={{ color: "var(--a-fg)" }}>{a.customer} · {CHANNEL_LABEL[a.channel]}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(a.at)} · {a.minutes} min</p></li>)}</ul>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Star size={16} /> Latest reviews</p>
          <ul className="space-y-3">{MOCK_REVIEWS.slice(0, 3).map((r) => <li key={r.id} className="text-sm"><p className="flex items-center gap-2" style={{ color: "var(--a-fg)" }}>{r.customer} <Stars value={r.rating} size={11} /></p><p className="line-clamp-2" style={{ color: "var(--a-muted)" }}>{r.text}</p></li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
