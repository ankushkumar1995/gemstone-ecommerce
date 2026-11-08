"use client";

/**
 * Remedy sales (DEMO). Products a partner can suggest in chat, the commission
 * on each, and sales made through their suggestions. Commission is confirmed
 * only after delivery and the return window; returns reverse it.
 */

import Image from "next/image";
import { CheckCircle2, Clock, IndianRupee, RotateCcw, ShoppingBag } from "lucide-react";
import { Badge, Card, PageHeader, StatCard, StatsSkeleton } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, fmtDateTime, inr } from "../../_components/demo";
import { MOCK_PRODUCTS, MOCK_REMEDY_SALES } from "../../_components/mock-data";

const STATUS = {
  delivered: { tone: "green" as const, label: "Earned" },
  shipped: { tone: "gold" as const, label: "Pending delivery" },
  returned: { tone: "rose" as const, label: "Returned (reversed)" },
};

export default function RemediesPage() {
  const { me, loading } = usePartner();
  if (loading || !me) return <StatsSkeleton count={4} />;
  const earned = MOCK_REMEDY_SALES.filter((s) => s.status === "delivered").reduce((a, s) => a + s.commission, 0);
  const pending = MOCK_REMEDY_SALES.filter((s) => s.status === "shipped").reduce((a, s) => a + s.commission, 0);
  const reversed = MOCK_REMEDY_SALES.filter((s) => s.status === "returned").reduce((a, s) => a + s.commission, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Remedy sales" subtitle="Earn a commission when customers buy what you suggest" />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={ShoppingBag} value={MOCK_REMEDY_SALES.length} label="Orders from your suggestions" tone="royal" />
        <StatCard icon={CheckCircle2} value={inr(earned)} label="Commission earned" tone="green" />
        <StatCard icon={Clock} value={inr(pending)} label="Pending delivery" tone="gold" />
        <StatCard icon={RotateCcw} value={inr(reversed)} label="Reversed (returns)" tone="rose" />
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Sales</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Product</th><th className="font-medium">Customer</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">Commission</th><th className="pl-4 font-medium">Status</th></tr></thead>
            <tbody>
              {MOCK_REMEDY_SALES.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="py-2.5"><span className="font-medium">{s.product}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(s.at)}</span></td>
                  <td>{s.customer}</td>
                  <td className="text-right tabular-nums">{inr(s.price)}</td>
                  <td className="text-right font-medium tabular-nums">{inr(s.commission)}</td>
                  <td className="pl-4"><Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>What you can suggest</p>
        <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Open the Suggest tab inside a live session to send any of these as a card.</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MOCK_PRODUCTS.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md"><Image src={p.image} alt="" fill sizes="56px" className="object-cover" /></div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{p.name}</p>
                <p className="text-xs" style={{ color: "var(--a-muted)" }}>{inr(p.price)} · for {p.planet}</p>
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><IndianRupee size={11} />{p.commissionPct}% · {inr(Math.round(p.price * p.commissionPct) / 100)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Fair selling rules</p>
        <ul className="list-disc space-y-1 pl-5" style={{ color: "var(--a-muted)" }}>
          <li>Suggest a product only when it truly fits the customer&apos;s chart. Never pressure or scare a customer into buying.</li>
          <li>Do not promise guaranteed results from any gemstone or remedy.</li>
          <li>Only products from the Astrounkle shop count. Selling outside the platform leads to suspension.</li>
          <li>Commission is confirmed 7 days after delivery. Returns reverse it.</li>
        </ul>
      </Card>
    </div>
  );
}
