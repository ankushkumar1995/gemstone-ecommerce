"use client";

/**
 * Offers (DEMO). Platform campaigns a partner can opt into (who pays for the
 * discount is stated up front) and the partner's own "happy hours" discount.
 */

import { useState } from "react";
import { BadgePercent, Clock, Info } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, Badge, Card, Field, PageHeader, StatsSkeleton, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner } from "../../_components/demo";
import { MOCK_OFFERS } from "../../_components/mock-data";

export default function OffersPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [offers, setOffers] = useState(MOCK_OFFERS);
  const [happy, setHappy] = useState({ on: false, pct: 10, from: "14:00", to: "17:00" });

  if (loading || !me) return <StatsSkeleton count={3} />;
  const chatRate = me.rates.chat;
  const discounted = Math.max(1, Math.round(chatRate * (100 - happy.pct)) / 100);
  const happyErr = happy.from >= happy.to ? "End time must be after start time" : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Offers" subtitle="Get more customers with campaigns and discounts" />
      <DemoBanner />

      <div className="grid gap-4 md:grid-cols-3">
        {offers.map((o) => (
          <Card key={o.id} className="flex flex-col p-5">
            <BadgePercent size={20} style={{ color: "var(--a-gold)" }} />
            <p className="mt-2 font-semibold" style={{ color: "var(--a-fg)" }}>{o.title}</p>
            <p className="mt-1 flex-1 text-sm" style={{ color: "var(--a-muted)" }}>{o.desc}</p>
            <p className="mt-3"><Badge tone="green">{o.impact}</Badge></p>
            <div className="mt-4">
              <Toggle checked={o.joined} onChange={(v) => { setOffers((l) => l.map((x) => (x.id === o.id ? { ...x, joined: v } : x))); toast(v ? `Joined: ${o.title}` : `Left: ${o.title}`, v ? "success" : "info"); }} label={o.joined ? "Joined" : "Join"} />
            </div>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-5">
        <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Clock size={16} /> Happy hours (your own discount)</p>
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>Lower your chat rate during quiet hours. You pay for this discount, so it comes out of your share.</p>
        <Toggle checked={happy.on} onChange={(v) => setHappy({ ...happy, on: v })} label="Run happy hours every day" />
        <div className="grid max-w-xl gap-3 sm:grid-cols-3">
          <Field label="Discount"><AdminSelect value={happy.pct} onChange={(e) => setHappy({ ...happy, pct: Number(e.target.value) })}>{[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}%</option>)}</AdminSelect></Field>
          <Field label="From"><AdminInput type="time" value={happy.from} onChange={(e) => setHappy({ ...happy, from: e.target.value })} /></Field>
          <Field label="To"><AdminInput type="time" value={happy.to} onChange={(e) => setHappy({ ...happy, to: e.target.value })} /></Field>
        </div>
        {happyErr ? <p className="text-sm text-rose-700">{happyErr}</p> : chatRate > 0 && <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--a-fg)" }}><Info size={14} /> Chat rate becomes ₹{discounted}/min (from ₹{chatRate}) between {happy.from} and {happy.to}.</p>}
        <AdminButton disabled={!!happyErr} onClick={() => toast(happy.on ? "Happy hours saved" : "Happy hours turned off", "success")}>Save</AdminButton>
      </Card>
    </div>
  );
}
