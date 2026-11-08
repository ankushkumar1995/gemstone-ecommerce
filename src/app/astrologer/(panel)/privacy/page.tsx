"use client";

/**
 * Privacy & data (DPDP Act 2023).
 *   • What we hold and why, with retention periods
 *   • Download: quick JSON now (REAL: your account data from the server, with
 *     file keys and internal fields removed, plus this browser's demo data);
 *     full archive on request (one per 7 days, ready within 48 hours, DEMO)
 *   • Consents: as easy to withdraw as to give, with the time of change
 *   • Delete account (DEMO): blocked during a live session or live stream;
 *     reason, type DELETE, OTP; 30-day grace period with cancel; final payout
 *     is made first; records the law requires are kept, the rest is erased
 */

import { useState } from "react";
import Link from "next/link";
import { Database, Download, FileArchive, Loader2, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, Field, Modal, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DEMO_SESSION_KEY, fmtDateTime, inr, nowMs } from "../../_components/demo";
import { agreementStore, blockedStore, consentStore, deletionStore, exportsStore, followUpsStore, liveStore, reportsStore, taxProfileStore, twoStepStore, useStore } from "../../_components/demo-store";

const D = 86400000;
const GRACE_DAYS = 30;
const REASONS = ["Not getting enough customers", "Fees are too high", "Taking a long break", "Joining another platform", "Privacy concerns", "Other"];

const HOLDINGS = [
  { what: "Profile (name, photo, bio, languages, rates)", why: "To show you to customers", keep: "Deleted 30 days after closing" },
  { what: "KYC documents (PAN, Aadhaar, bank proof)", why: "Legal verification and payouts", keep: "Kept as required by law, then deleted" },
  { what: "Payout account", why: "To pay you", keep: "Deleted after the final payout" },
  { what: "Earnings, invoices and TDS records", why: "Tax law", keep: "Kept up to 8 years as tax law requires" },
  { what: "Chat transcripts and session records", why: "Customer complaints and safety", keep: "180 days after the session, then deleted" },
  { what: "Reviews about you", why: "Customer trust", keep: "Kept but no longer linked to your name" },
  { what: "Login history and devices", why: "Account security", keep: "90 days" },
];

export default function PrivacyPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const consent = useStore(consentStore);
  const deletion = useStore(deletionStore);
  const exports = useStore(exportsStore);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<null | { step: 1 | 2; reason: string; note: string; confirm: string; otp?: string; code: string }>(null);
  useOnMount(() => setNow(nowMs()));

  if (loading || !me || !now) return <StatsSkeleton count={3} />;
  const inSession = typeof window !== "undefined" && Boolean(sessionStorage.getItem(DEMO_SESSION_KEY));
  const isLive = liveStore.get() !== null;
  const lastFull = exports.find((e) => e.kind === "full");
  const fullAllowed = !lastFull || now - Date.parse(lastFull.at) > 7 * D;
  const payable = 6240.5;

  const quickDownload = () => {
    setBusy(true);
    // Strip storage keys and internal fields before handing data out.
    const { kyc, ...rest } = me;
    const data = {
      exportedAt: new Date(nowMs()).toISOString(),
      notice: "Your Astrounkle partner data. Fields marked demo come from this browser while those features are in preview.",
      account: { ...rest, kyc: kyc.map(({ fileKey: _k, ...d }) => { void _k; return d; }) },
      demo: {
        agreementSignatures: agreementStore.get(), taxProfile: taxProfileStore.get(), twoStepLogin: { method: twoStepStore.get().method, enabledAt: twoStepStore.get().enabledAt },
        consents: consent, blockedCustomers: blockedStore.get(), reportsFiled: reportsStore.get(), followUps: followUpsStore.get() ?? [],
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `astrounkle-partner-data-${new Date(nowMs()).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    exportsStore.set((l) => [{ id: `ex_${nowMs()}`, at: new Date(nowMs()).toISOString(), kind: "quick" as const, status: "ready" as const }, ...l].slice(0, 20));
    setBusy(false);
    toast("Your data was downloaded", "success");
  };

  const requestFull = () => {
    if (!fullAllowed) return;
    exportsStore.set((l) => [{ id: `ex_${nowMs()}`, at: new Date(nowMs()).toISOString(), kind: "full" as const, status: "preparing" as const }, ...l].slice(0, 20));
    toast("Requested. We email a secure download link within 48 hours.", "success");
  };

  const setConsent = (patch: Partial<typeof consent>) => consentStore.set({ ...consent, ...patch, updatedAt: new Date(nowMs()).toISOString() });

  const startDelete = () => {
    if (inSession || isLive) return toast("Finish your live session or live stream first.", "error");
    setDel({ step: 1, reason: REASONS[0], note: "", confirm: "", code: "" });
  };
  const sendOtp = () => {
    if (!del) return;
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setDel({ ...del, step: 2, otp: c, code: "" });
    toast(`Demo OTP sent to ••••••${me.phone.slice(-4)}: ${c}`, "info");
  };
  const confirmDelete = () => {
    if (!del?.otp || del.code !== del.otp) return toast("Wrong OTP", "error");
    const t = nowMs();
    deletionStore.set({ requestedAt: new Date(t).toISOString(), scheduledFor: new Date(t + GRACE_DAYS * D).toISOString(), reason: del.reason + (del.note.trim() ? `: ${del.note.trim()}` : "") });
    setDel(null);
    toast(`Deletion scheduled. You can cancel within ${GRACE_DAYS} days.`, "info");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Privacy & data" subtitle="Your rights under the Digital Personal Data Protection Act, 2023" />

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Database size={16} /> What we hold about you</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Data</th><th className="font-medium">Why</th><th className="font-medium">How long</th></tr></thead>
            <tbody>{HOLDINGS.map((h) => <tr key={h.what} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}><td className="py-2.5 pr-3">{h.what}</td><td className="pr-3" style={{ color: "var(--a-muted)" }}>{h.why}</td><td style={{ color: "var(--a-muted)" }}>{h.keep}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><UserCog size={13} /> Something wrong? Correct it in <Link className="underline" href="/astrologer/profile">Profile & rates</Link> or <Link className="underline" href="/astrologer/kyc">KYC & payout</Link>.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Download size={16} /> Download your data</p>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Quick download gives your account, KYC status, payout account (masked), activity and settings as a file right now.</p>
          <AdminButton onClick={quickDownload} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download now (JSON)</AdminButton>
          <div className="border-t pt-3" style={{ borderColor: "var(--a-border)" }}>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>Full archive adds session records, transcripts, invoices and statements.</p>
            <AdminButton className="mt-2" variant="outline" onClick={requestFull} disabled={!fullAllowed}><FileArchive size={15} /> Request full archive</AdminButton>
            {!fullAllowed && lastFull && <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>One full archive every 7 days. Last requested {fmtDateTime(lastFull.at)}.</p>}
          </div>
          {exports.length > 0 && <ul className="space-y-1 text-xs" style={{ color: "var(--a-muted)" }}>{exports.slice(0, 5).map((e) => <li key={e.id} className="flex justify-between"><span>{e.kind === "full" ? "Full archive" : "Quick download"} · {fmtDateTime(e.at)}</span><Badge tone={e.status === "ready" ? "green" : "gold"}>{e.status}</Badge></li>)}</ul>}
        </Card>

        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><ShieldCheck size={16} /> Your consents</p>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Service messages (requests, payouts, security) are needed to run your account and cannot be turned off here.</p>
          <Toggle checked={consent.marketing} onChange={(v) => setConsent({ marketing: v })} label="Tips, campaigns and offers by email" />
          <Toggle checked={consent.whatsapp} onChange={(v) => setConsent({ whatsapp: v })} label="Updates on WhatsApp" />
          <Toggle checked={consent.research} onChange={(v) => setConsent({ research: v })} label="Invite me to product research" />
          <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>{consent.updatedAt ? `Last changed ${fmtDateTime(consent.updatedAt)}` : "Not changed yet"}</p>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-semibold text-rose-700"><Trash2 size={16} /> Delete my partner account</p>
        {deletion ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--a-fg)" }}>Deletion scheduled for <b>{new Date(deletion.scheduledFor).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b> ({Math.max(0, Math.ceil((Date.parse(deletion.scheduledFor) - now) / D))} days left). Your profile is hidden from customers until then.</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Requested {fmtDateTime(deletion.requestedAt)} · {deletion.reason}</p>
            <AdminButton onClick={() => { deletionStore.set(null); toast("Deletion cancelled. Welcome back.", "success"); }}>Cancel deletion</AdminButton>
          </div>
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--a-muted)" }}>
              <li>Your profile is hidden at once and removed after {GRACE_DAYS} days. You can cancel any time before that.</li>
              <li>Your payable balance of <b style={{ color: "var(--a-fg)" }}>{inr(payable)}</b> and earnings still on hold are paid to your bank first.</li>
              <li>Open complaints are closed first. Tax and legal records are kept only as long as the law requires.</li>
              <li>Want a pause instead? <Link className="underline" href="/astrologer/security">Deactivate</Link> keeps everything and you can come back.</li>
            </ul>
            {(inSession || isLive) && <p className="text-sm text-amber-700">Finish your live session or live stream to continue.</p>}
            <AdminButton variant="danger" onClick={startDelete}>Delete my account</AdminButton>
          </>
        )}
        <p className="border-t pt-3 text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>Grievance Officer: grievance@astrounkle.com (reply in 72 hours). If you are not satisfied, you can approach the Data Protection Board of India.</p>
      </Card>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete your partner account?" subtitle={`You have ${GRACE_DAYS} days to change your mind.`} size="sm">
        {del && del.step === 1 && (
          <div className="space-y-4">
            <Field label="Why are you leaving?"><AdminSelect value={del.reason} onChange={(e) => setDel({ ...del, reason: e.target.value })}>{REASONS.map((r) => <option key={r}>{r}</option>)}</AdminSelect></Field>
            <Field label="Anything we should know? (optional)"><AdminTextarea rows={2} value={del.note} onChange={(e) => setDel({ ...del, note: e.target.value.slice(0, 300) })} /></Field>
            <Field label="Type DELETE to confirm"><AdminInput value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value.slice(0, 10) })} /></Field>
            <AdminButton className="w-full" variant="danger" disabled={del.confirm !== "DELETE"} onClick={sendOtp}>Send OTP</AdminButton>
          </div>
        )}
        {del && del.step === 2 && (
          <div className="space-y-4">
            <Field label={`OTP sent to ••••••${me.phone.slice(-4)}`}><AdminInput inputMode="numeric" value={del.code} onChange={(e) => setDel({ ...del, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} autoComplete="one-time-code" /></Field>
            <AdminButton className="w-full" variant="danger" disabled={del.code.length !== 6} onClick={confirmDelete}>Schedule deletion</AdminButton>
          </div>
        )}
      </Modal>
    </div>
  );
}
