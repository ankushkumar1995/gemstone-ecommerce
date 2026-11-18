"use client";

/**
 * Payouts (real). Withdraw the withdrawable balance to the verified bank / UPI
 * account. One payout at a time; it is approved and sent by AstroUnkle, and the
 * bank reference (UTR) shows here when paid. TDS is deducted when enabled.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Landmark, ShieldAlert } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, ConfirmDialog, Field, PageHeader, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type EarningsBalance, type EarningsRules, type Payout } from "@/lib/astrologer-api";
import { usePartner } from "../../_components/partner-context";

const inr = (paise: number) => `${paise < 0 ? "−" : ""}₹${(Math.abs(paise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "-");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const newId = () => { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };

const PAYOUT_STATUS: Record<Payout["status"], { label: string; tone: "green" | "gold" | "muted" | "rose" | "blue" | "royal" }> = {
  requested: { label: "Waiting for approval", tone: "gold" },
  approved: { label: "Approved, sending soon", tone: "blue" },
  processing: { label: "Sending", tone: "royal" },
  paid: { label: "Paid", tone: "green" },
  failed: { label: "Failed, money returned", tone: "rose" },
  rejected: { label: "Not approved, money returned", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export default function PayoutsPage() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const [data, setData] = useState<{ payouts: Payout[]; balance: EarningsBalance; rules: EarningsRules } | null>(null);
  const [amount, setAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reqId, setReqId] = useState(newId);

  const load = useCallback(async () => {
    const r = await partnerApi.earnings.payouts();
    if (r.ok) setData(r.data); else toast(r.message, "error");
  }, [toast]);
  useOnMount(() => { void load(); });

  const max = data ? Math.max(0, Math.floor(data.balance.availablePaise / 100)) : 0;
  const rupees = amount.trim() ? Math.floor(Number(amount)) : max;
  const tdsRate = data?.rules.tds.enabled ? (me?.kyc.some((k) => k.type === "pan" && k.status === "verified") ? data.rules.tds.ratePct : data.rules.tds.noPanRatePct) : 0;
  const tds = Math.round(rupees * 100 * tdsRate / 100);
  const open = useMemo(() => data?.payouts.find((p) => p.status === "requested" || p.status === "approved" || p.status === "processing") ?? null, [data]);

  if (!data || !me) return <StatsSkeleton count={3} />;
  const { balance, rules } = data;
  const account = me.payout;
  const accountOk = Boolean(account) && (!rules.requireVerifiedAccount || account?.verified);
  const minR = rules.minPayoutPaise / 100;
  const blocked = !accountOk ? "account" : open ? "open" : max < minR ? "min" : null;

  async function submit() {
    setConfirm(false);
    const r = await partnerApi.earnings.requestPayout(reqId, rupees * 100);
    setReqId(newId());
    if (!r.ok) return toast(r.message, "error");
    setAmount("");
    toast(`Payout ${r.data.payout.payoutNumber} requested.`, "success");
    void load();
  }

  async function cancel() {
    if (!cancelId) return;
    const id = cancelId;
    setCancelId(null);
    const r = await partnerApi.earnings.cancelPayout(id);
    if (!r.ok) return toast(r.message, "error");
    toast("Payout cancelled. The money is back in your balance.", "info");
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" subtitle={`Minimum ${inr(rules.minPayoutPaise)}. ${rules.autoCreate ? `A payout is created for you every ${DAYS[rules.cycleWeekday]} when you have enough.` : "Request whenever you have enough."} Earnings are on hold ${rules.holdDays} days first.`} />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Withdrawable now</p>
              <p className="text-3xl font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{inr(balance.availablePaise)}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{inr(balance.onHoldPaise)} on hold{balance.nextReleaseAt ? `, ${inr(balance.nextReleasePaise)} frees on ${new Date(balance.nextReleaseAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}</p>
            </div>
            <Link href="/astrologer/earnings" className="text-sm font-medium" style={{ color: "var(--a-gold)" }}>See all earnings</Link>
          </div>

          {blocked === "account" ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <p>{account ? "Your payout account is being verified. You can withdraw once it is verified." : "Add your bank or UPI details to withdraw."} <Link href="/astrologer/kyc" className="font-semibold underline">KYC & payout</Link></p>
            </div>
          ) : blocked === "open" ? (
            <p className="rounded-lg p-3 text-sm" style={{ background: "var(--a-gold-soft)" }}>Payout {open?.payoutNumber} is in progress. You can request the next one after it is done.</p>
          ) : blocked === "min" ? (
            <p className="rounded-lg p-3 text-sm" style={{ background: "rgba(0,0,0,0.04)", color: "var(--a-muted)" }}>You can withdraw once you have {inr(rules.minPayoutPaise)} withdrawable.</p>
          ) : (
            <div className="space-y-3">
              <Field label="Amount (₹)" hint={`Up to ${inr(max * 100)}${rules.maxPerRequestPaise ? `, most ${inr(rules.maxPerRequestPaise)} per payout` : ""}. Leave empty for the full amount.`}>
                <AdminInput type="number" min={minR} max={max} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(max)} />
              </Field>
              <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
                <Row k="Withdraw" v={inr(rupees * 100)} />
                {tdsRate > 0 && <Row k={`TDS (${tdsRate}%)`} v={`−${inr(tds)}`} />}
                <Row k="To your account" v={<b>{inr(rupees * 100 - tds)}</b>} />
              </div>
              <AdminButton onClick={() => {
                if (!Number.isFinite(rupees) || rupees < minR) return toast(`Minimum ${inr(rules.minPayoutPaise)}`, "error");
                if (rupees > max) return toast(`You can withdraw up to ${inr(max * 100)}`, "error");
                setConfirm(true);
              }}><Landmark size={15} /> Request payout</AdminButton>
            </div>
          )}
        </Card>

        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Pays to</p>
          {account ? (
            <>
              <p className="text-sm" style={{ color: "var(--a-fg)" }}>{account.method === "bank" ? `${account.bankName ?? "Bank"} · ${account.accountNumberMasked}` : account.upiId}</p>
              <p className="text-xs" style={{ color: "var(--a-muted)" }}>{account.accountHolder}{account.ifsc ? ` · ${account.ifsc}` : ""}</p>
              {account.verified ? <Badge tone="green"><CheckCircle2 size={11} className="mr-1 inline" />Verified</Badge> : <Badge tone="gold">Being verified</Badge>}
            </>
          ) : <p className="text-sm" style={{ color: "var(--a-muted)" }}>No account added.</p>}
          <Link href="/astrologer/kyc" className="block text-xs font-medium" style={{ color: "var(--a-gold)" }}>Change payout account</Link>
          {rules.tds.enabled && <p className="pt-2 text-xs" style={{ color: "var(--a-muted)" }}>TDS: {rules.tds.ratePct}% with a verified PAN, {rules.tds.noPanRatePct}% without. See <Link href="/astrologer/tax" className="underline">Tax & invoices</Link>.</p>}
        </Card>
      </div>

      <Card className="p-0">
        <p className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>Payout history</p>
        {data.payouts.length === 0 ? <p className="py-10 text-center text-sm" style={{ color: "var(--a-muted)" }}>No payouts yet.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {data.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>{p.payoutNumber} · {inr(p.netPaise)} to {p.destination.method === "bank" ? p.destination.accountNumberMasked : p.destination.upiId}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>
                    {when(p.createdAt)}{p.tdsPaise ? ` · withdrew ${inr(p.amountPaise)}, TDS ${inr(p.tdsPaise)}` : ""}{p.utr ? ` · UTR ${p.utr}` : ""}{p.failureReason ? ` · ${p.failureReason}` : ""}
                    {p.requestedBy === "auto" ? " · created by the weekly cycle" : ""}
                  </p>
                </div>
                <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                {p.status === "requested" && <AdminButton variant="ghost" onClick={() => setCancelId(p.id)}>Cancel</AdminButton>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void submit()} confirmLabel="Request payout" title="Request this payout?"
        message={`${inr(rupees * 100 - tds)} will be sent to ${account?.method === "bank" ? account.accountNumberMasked : account?.upiId} after approval.${tds ? ` TDS ${inr(tds)} is deducted.` : ""}`} />
      <ConfirmDialog open={cancelId !== null} onClose={() => setCancelId(null)} onConfirm={() => void cancel()} confirmLabel="Cancel payout" danger title="Cancel this payout?" message="The money goes back to your withdrawable balance." />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between py-0.5"><span style={{ color: "var(--a-muted)" }}>{k}</span><span className="tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</span></div>;
}
