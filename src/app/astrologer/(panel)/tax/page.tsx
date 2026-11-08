"use client";

/**
 * Tax & invoices (DEMO save). GST registration (GSTIN validated by format,
 * state code and checksum; its PAN part must match your KYC PAN's last
 * characters), billing address and state (decides CGST+SGST vs IGST), TDS
 * declarations (decide the TDS rate), an optional lower-deduction certificate,
 * a change history, monthly invoices (premium PDF) and quarterly Form 16A.
 *
 * Changes apply from the next statement; past invoices never change.
 */

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileText, History, Landmark, Receipt, ShieldCheck } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, Field, PageHeader, StatCard, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, inr, nowMs, fmtDateTime } from "../../_components/demo";
import { taxHistoryStore, taxProfileStore, useStore } from "../../_components/demo-store";
import { GST_STATES, PLATFORM, buildStatements, tdsRate, validateGstin, type TaxProfile } from "../../_components/legal";

export default function TaxPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const saved = useStore(taxProfileStore);
  const history = useStore(taxHistoryStore);
  const [draft, setDraft] = useState<TaxProfile | null>(null);
  const [now, setNow] = useState(0);
  useOnMount(() => setNow(nowMs()));

  if (loading || !me || !now) return <StatsSkeleton count={4} />;
  const p = draft ?? saved;
  const set = (patch: Partial<TaxProfile>) => setDraft({ ...p, ...patch });
  const pan = me.kyc.find((k) => k.type === "pan")?.numberMasked;
  const g = p.gstRegistered ? validateGstin(p.gstin) : null;
  // The masked KYC PAN ("XXXXX1234F") keeps its last 5 characters visible.
  const panTail = pan && /^X{5}[0-9]{4}[A-Z]$/.test(pan) ? pan.slice(5) : "";
  const panMismatch = g?.ok && panTail !== "" && g.pan.slice(5) !== panTail;
  const stateMismatch = g?.ok && p.gstin.trim().slice(0, 2) !== p.stateCode;
  const errors = [
    p.gstRegistered && g && !g.ok ? g.error : null,
    panMismatch ? "This GSTIN does not belong to the PAN in your KYC" : null,
    stateMismatch ? "Billing state must match the GSTIN state code" : null,
    p.gstRegistered && p.gstLegalName.trim().length < 3 ? "Enter the legal name as on your GST certificate" : null,
    p.address.trim().length < 10 ? "Enter your full billing address" : null,
    p.lowerCertNo.trim() && !/^\d+(\.\d{1,2})?$/.test(p.lowerCertRate.trim()) ? "Enter the rate on your lower-deduction certificate" : null,
  ].filter(Boolean) as string[];
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const tds = tdsRate(p);
  const statements = buildStatements(me.effectiveCommissionPct, saved, saved.stateCode, 6, now);
  const ytdTds = statements.reduce((a, s) => a + s.tds, 0);

  const save = () => {
    if (errors.length || !draft) return;
    const changes: string[] = [];
    if (draft.gstRegistered !== saved.gstRegistered || draft.gstin !== saved.gstin) changes.push(draft.gstRegistered ? `GSTIN ${draft.gstin.toUpperCase()}` : "Marked not GST registered");
    if (draft.stateCode !== saved.stateCode) changes.push(`State ${GST_STATES[draft.stateCode]}`);
    if (draft.panAadhaarLinked !== saved.panAadhaarLinked || draft.itrFiled !== saved.itrFiled || draft.resident !== saved.resident) changes.push("TDS declarations");
    if (draft.lowerCertNo !== saved.lowerCertNo) changes.push("Lower deduction certificate");
    if (draft.address !== saved.address) changes.push("Billing address");
    const at = new Date(nowMs()).toISOString();
    taxProfileStore.set({ ...draft, gstin: draft.gstin.trim().toUpperCase(), savedAt: at });
    taxHistoryStore.set((h) => [{ at, summary: changes.join(", ") || "Saved" }, ...h].slice(0, 30));
    setDraft(null);
    toast("Tax profile saved. It applies from your next statement.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Tax & invoices" subtitle="GST, TDS and your monthly invoices" action={<AdminButton onClick={save} disabled={!dirty || errors.length > 0}>Save tax profile</AdminButton>} />
      <DemoBanner what="Amounts on invoices" />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Receipt} value={saved.gstRegistered ? "Registered" : "Not registered"} label="GST status" tone="royal" />
        <StatCard icon={ShieldCheck} value={`${tdsRate(saved).rate}%`} label="Your TDS rate" tone="gold" />
        <StatCard icon={Landmark} value={inr(Math.round(ytdTds))} label="TDS, last 6 months" tone="blue" />
        <StatCard icon={FileText} value={statements.length} label="Invoices" tone="green" />
      </div>

      {errors.length > 0 && dirty && <ul className="space-y-1 rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-700" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>GST</p>
          <Toggle checked={p.gstRegistered} onChange={(v) => set({ gstRegistered: v })} label="I am registered under GST" />
          {p.gstRegistered && (
            <>
              <Field label="GSTIN" hint={g?.ok ? `${g.state} · checksum valid` : "15 characters"}>
                <AdminInput value={p.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15) })} placeholder="08ABCDE1234F1Z5" />
              </Field>
              {g?.ok && !panMismatch && <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={13} /> Valid GSTIN for {g.state}</p>}
              <Field label="Legal name on GST certificate"><AdminInput value={p.gstLegalName} onChange={(e) => set({ gstLegalName: e.target.value.slice(0, 120) })} /></Field>
            </>
          )}
          {!p.gstRegistered && <p className="text-xs" style={{ color: "var(--a-muted)" }}>You need GST registration only if your yearly turnover crosses the threshold. Ask your CA if unsure.</p>}
          <Field label="Billing state" hint="Decides CGST + SGST or IGST on the platform fee">
            <AdminSelect value={p.stateCode} onChange={(e) => set({ stateCode: e.target.value })}>
              {Object.entries(GST_STATES).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
            </AdminSelect>
          </Field>
          <Field label="Billing address"><AdminTextarea rows={2} value={p.address} onChange={(e) => set({ address: e.target.value.slice(0, 250) })} placeholder="House, street, city, PIN" /></Field>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{p.stateCode === PLATFORM.stateCode ? "Same state as Astrounkle: CGST 9% + SGST 9% on the platform fee." : "Different state from Astrounkle: IGST 18% on the platform fee."}</p>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>TDS declaration</p>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>PAN on file: <b style={{ color: "var(--a-fg)" }}>{pan ?? "Not submitted"}</b> {!pan && <Link className="underline" href="/astrologer/kyc">Add in KYC</Link>}</p>
          <Toggle checked={p.resident} onChange={(v) => set({ resident: v })} label="I am a resident of India for tax" />
          <Toggle checked={p.panAadhaarLinked} onChange={(v) => set({ panAadhaarLinked: v })} label="My PAN is linked with Aadhaar" />
          <Toggle checked={p.itrFiled} onChange={(v) => set({ itrFiled: v })} label="I filed my income tax return for the last year" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lower deduction cert. (Sec 197)" hint="Optional"><AdminInput value={p.lowerCertNo} onChange={(e) => set({ lowerCertNo: e.target.value.toUpperCase().slice(0, 20) })} /></Field>
            <Field label="Rate on certificate (%)"><AdminInput inputMode="decimal" value={p.lowerCertRate} onChange={(e) => set({ lowerCertRate: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })} disabled={!p.lowerCertNo.trim()} /></Field>
          </div>
          {!p.resident && <p className="text-xs text-amber-700">Non-resident partners are taxed differently. Our team will contact you before the next payout.</p>}
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>TDS rate: <b>{tds.rate}%</b> · {tds.why}</div>
          <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>By saving you declare these details are true. Wrong declarations can lead to recovery of short-deducted tax.</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Monthly invoices</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Invoice</th><th className="font-medium">Month</th><th className="text-right font-medium">Platform fee + GST</th><th className="text-right font-medium">TDS</th><th className="text-right font-medium">Net payout</th><th className="pl-4 font-medium">Status</th><th /></tr></thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="py-2.5 font-mono text-xs">{s.id}</td>
                  <td>{s.label}</td>
                  <td className="text-right tabular-nums">{inr(Math.round((s.fee + s.cgst + s.sgst + s.igst) * 100) / 100)}</td>
                  <td className="text-right tabular-nums">{inr(s.tds)}</td>
                  <td className="text-right font-medium tabular-nums">{inr(s.net)}</td>
                  <td className="pl-4"><Badge tone={s.status === "paid" ? "green" : "gold"}>{s.status === "paid" ? "Settled" : "Processing"}</Badge></td>
                  <td className="text-right"><Link href={`/astrologer/invoice/${s.id}`} target="_blank"><AdminButton variant="ghost" aria-label={`Open invoice ${s.id}`}><Download size={15} /> PDF</AdminButton></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>Invoices are generated on the 3rd of every month for the previous month.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>TDS certificates (Form 16A)</p>
          <ul className="space-y-2 text-sm">
            {["Q2 FY 2026-27 (Jul to Sep)", "Q1 FY 2026-27 (Apr to Jun)", "Q4 FY 2025-26 (Jan to Mar)"].map((q, i) => (
              <li key={q} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                <span>{q}</span>
                {i === 0 ? <Badge tone="gold">Available 15 Nov</Badge> : <AdminButton variant="ghost" onClick={() => toast("Form 16A downloads start when payouts go live", "info")}><Download size={15} /></AdminButton>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><History size={16} /> Change history</p>
          {history.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No changes yet.</p> : (
            <ul className="space-y-1.5 text-sm">{history.map((h, i) => <li key={i} className="flex justify-between gap-3"><span style={{ color: "var(--a-fg)" }}>{h.summary}</span><span className="shrink-0 text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(h.at)}</span></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
