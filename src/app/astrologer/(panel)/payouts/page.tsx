"use client";

/**
 * Payouts (DEMO). Payable balance, the verified payout destination (real, from
 * the partner's account), the payout cycle, early payout requests, history with
 * bank UTR numbers, and tax documents.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Download, FileText, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { AdminButton, Badge, Card, CopyButton, Modal, PageHeader, StatCard, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, fmtDateTime, inr, nowMs } from "../../_components/demo";
import { MOCK_PAYOUTS, type MockPayout } from "../../_components/mock-data";

const MIN_PAYOUT = 500;
const EARLY_FEE_PCT = 1;
const TONE: Record<MockPayout["status"], "green" | "gold" | "blue" | "rose"> = { paid: "green", processing: "gold", scheduled: "blue", failed: "rose" };

function nextMonday() {
  const d = new Date(nowMs());
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export default function PayoutsPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [payable, setPayable] = useState(6240.5);
  const [payouts, setPayouts] = useState(MOCK_PAYOUTS);
  const [ask, setAsk] = useState(false);

  if (loading || !me) return <StatsSkeleton count={4} />;
  const dest = me.payout;
  const fee = Math.round(payable * EARLY_FEE_PCT) / 100;
  const paidTotal = payouts.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);

  const requestEarly = () => {
    setAsk(false);
    setPayouts((p) => [{ id: `po_${119 + p.length - MOCK_PAYOUTS.length}`, period: "Early payout", amount: Math.round((payable - fee) * 100) / 100, tds: 0, status: "processing", at: new Date(nowMs()).toISOString(), method: dest?.method === "upi" ? dest.upiId ?? "UPI" : `${dest?.bankName ?? "Bank"} ${dest?.accountNumberMasked ?? ""}` }, ...p]);
    setPayable(0);
    toast("Payout requested. It usually reaches your bank within 24 hours.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" subtitle={`Paid every week, minimum ${inr(MIN_PAYOUT)}`} />
      <DemoBanner what="Balances and history on this page" />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Wallet} value={inr(payable)} label="Payable now" tone="green" />
        <StatCard icon={CalendarClock} value={nextMonday()} label="Next payout" tone="blue" />
        <StatCard icon={Landmark} value={inr(paidTotal)} label="Paid so far" tone="royal" />
        <StatCard icon={FileText} value={inr(0)} label="TDS this year" tone="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Landmark size={16} /> Payout account</p>
          {dest ? (
            <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
              {dest.method === "bank" ? (<><p className="font-medium">{dest.bankName ?? "Bank account"} {dest.accountNumberMasked}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{dest.accountHolder} · IFSC {dest.ifsc}</p></>) : (<><p className="font-medium">UPI {dest.upiId}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{dest.accountHolder}</p></>)}
              <p className="mt-2 flex items-center gap-1 text-xs">{dest.verified ? <><ShieldCheck size={13} className="text-emerald-600" /> Verified</> : <><AlertTriangle size={13} className="text-amber-600" /> Waiting for verification</>}</p>
            </div>
          ) : (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">Add a payout account to get paid. <Link href="/astrologer/kyc" className="font-medium underline">Add now</Link></p>
          )}
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>To change it, update it in KYC & payout. Changes are re-verified, and payouts pause for 24 hours for your safety.</p>
        </Card>

        <Card className="space-y-3 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Need money before {nextMonday()}?</p>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Request an early payout of your payable balance. A {EARLY_FEE_PCT}% fee applies. Earnings on hold are not included.</p>
          <AdminButton onClick={() => setAsk(true)} disabled={payable < MIN_PAYOUT || !dest?.verified}>Request early payout</AdminButton>
          {payable < MIN_PAYOUT && <p className="text-xs" style={{ color: "var(--a-faint)" }}>Needs at least {inr(MIN_PAYOUT)} payable.</p>}
          {dest && !dest.verified && <p className="text-xs" style={{ color: "var(--a-faint)" }}>Available after your payout account is verified.</p>}
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Payout history</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Payout</th><th className="font-medium">Period</th><th className="text-right font-medium">Amount</th><th className="pl-4 font-medium">To</th><th className="font-medium">Status</th><th className="font-medium">Bank ref (UTR)</th></tr></thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="py-2.5"><span className="font-medium">{p.id}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(p.at)}</span></td>
                  <td>{p.period}</td>
                  <td className="text-right font-medium tabular-nums">{inr(p.amount)}</td>
                  <td className="pl-4 text-xs">{p.method}</td>
                  <td><Badge tone={TONE[p.status]}>{p.status}</Badge>{p.status === "failed" && <span className="block text-[11px] text-rose-700">Bank rejected. Retried with next payout.</span>}</td>
                  <td>{p.utr ? <span className="flex items-center gap-1"><code className="text-xs">{p.utr}</code><CopyButton value={p.utr} /></span> : <span style={{ color: "var(--a-faint)" }}>·</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Tax documents</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {["Form 16A · Q2 FY 2026-27", "Form 16A · Q1 FY 2026-27", "Commission invoice · Oct 2026", "Commission invoice · Sep 2026"].map((d) => (
            <li key={d} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
              <span className="flex items-center gap-2"><FileText size={15} style={{ color: "var(--a-gold)" }} />{d}</span>
              <AdminButton variant="ghost" onClick={() => toast("Documents are available once payouts go live", "info")} aria-label={`Download ${d}`}><Download size={15} /></AdminButton>
            </li>
          ))}
        </ul>
      </Card>

      <Modal open={ask} onClose={() => setAsk(false)} title="Request early payout" size="sm">
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-y-2">
            <dt style={{ color: "var(--a-muted)" }}>Payable</dt><dd className="text-right">{inr(payable)}</dd>
            <dt style={{ color: "var(--a-muted)" }}>Early payout fee ({EARLY_FEE_PCT}%)</dt><dd className="text-right">−{inr(fee)}</dd>
            <dt className="font-semibold">You receive</dt><dd className="text-right font-semibold text-emerald-700">{inr(Math.round((payable - fee) * 100) / 100)}</dd>
          </dl>
          <AdminButton className="w-full" onClick={requestEarly}>Confirm payout</AdminButton>
        </div>
      </Modal>
    </div>
  );
}
