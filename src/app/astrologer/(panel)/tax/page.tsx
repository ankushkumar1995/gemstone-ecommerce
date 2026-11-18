"use client";

/**
 * Tax (real): TDS deducted on paid payouts, by financial year (April to March),
 * and the PAN status that decides the rate. TDS is set by AstroUnkle (off until
 * confirmed with a chartered accountant).
 */

import { useState } from "react";
import Link from "next/link";
import { FileText, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type EarningsRules, type TdsYear } from "@/lib/astrologer-api";
import { usePartner } from "../../_components/partner-context";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function TaxPage() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const [data, setData] = useState<{ tds: TdsYear[]; rules: EarningsRules } | null>(null);
  useOnMount(() => { void partnerApi.earnings.get().then((r) => { if (r.ok) setData({ tds: r.data.tds, rules: r.data.rules }); else toast(r.message, "error"); }); });

  if (!data || !me) return <StatsSkeleton count={2} />;
  const pan = me.kyc.find((k) => k.type === "pan");
  const t = data.rules.tds;
  return (
    <div className="space-y-6">
      <PageHeader title="Tax & TDS" subtitle="TDS deducted from your payouts, by financial year (April to March)." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><ShieldCheck size={15} /> PAN</p>
          {pan ? <p className="text-sm">{pan.numberMasked ?? "On file"} <Badge tone={pan.status === "verified" ? "green" : pan.status === "rejected" ? "rose" : "gold"}>{pan.status}</Badge></p> : <p className="text-sm" style={{ color: "var(--a-muted)" }}>Not added. <Link href="/astrologer/kyc" className="underline">Add PAN</Link></p>}
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{t.enabled ? `TDS now: ${t.ratePct}% with a verified PAN, ${t.noPanRatePct}% without.` : "TDS is not deducted right now."}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><FileText size={15} /> Certificates</p>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>TDS certificates (Form 16A) are issued by AstroUnkle every quarter for the TDS shown below. Contact support for a copy.</p>
        </Card>
      </div>
      <Card className="p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>By financial year</p>
        {data.tds.length === 0 ? <p className="py-10 text-center text-sm" style={{ color: "var(--a-muted)" }}>No paid payouts yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}><th className="px-4 py-2">Year</th><th className="px-4 py-2">Payouts</th><th className="px-4 py-2 text-right">Withdrawn</th><th className="px-4 py-2 text-right">TDS</th></tr></thead>
            <tbody>
              {data.tds.map((y) => (
                <tr key={y.fy} className="border-b" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-2.5 font-medium">{y.fy}</td><td className="px-4 py-2.5">{y.payouts}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{inr(y.grossPaise)}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{inr(y.tdsPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
