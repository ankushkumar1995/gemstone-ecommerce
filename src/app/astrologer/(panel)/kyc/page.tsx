"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileUp, Lock, ShieldCheck } from "lucide-react";
import { KYC_DOC_TYPES, type KycDocType } from "@/modules/astrologers/astrologer.types";
import { IFSC_RE, PAN_RE, UPI_RE, validAadhaar } from "@/modules/astrologers/astrologer.schema";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, Card, Field, PageHeader, SegmentedControl, StatsSkeleton, StatusPill, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { KYC_LABEL, KYC_STATUS_META } from "../../_components/status-meta";

function DocRow({ type }: { type: KycDocType }) {
  const { me, setMe } = usePartner();
  const { toast } = useAdminToast();
  const [number, setNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const info = KYC_LABEL[type];
  const doc = me?.kyc.find((d) => d.type === type);
  const locked = doc?.status === "verified";

  const numberIssue = () => {
    if (info.needsNumber === "pan" && !PAN_RE.test(number.trim().toUpperCase())) return "Enter a valid PAN, e.g. ABCDE1234F";
    if (info.needsNumber === "aadhaar" && !validAadhaar(number)) return "Enter a valid 12-digit Aadhaar number";
    return null;
  };

  const submit = async () => {
    if (info.needsNumber) { const i = numberIssue(); if (i) { toast(i, "error"); return; } }
    if (!info.needsNumber && !file) { toast("Choose a file to upload", "error"); return; }
    setBusy(true);
    let fileKey: string | undefined;
    let fileName: string | undefined;
    if (file) {
      const up = await partnerApi.uploadKyc(type, file);
      if (!up.ok) { setBusy(false); toast(up.message, "error"); return; }
      fileKey = up.data.fileKey;
      fileName = up.data.fileName;
    }
    const res = await partnerApi.submitKyc({ type, number: info.needsNumber ? number.trim().toUpperCase() : undefined, fileKey, fileName });
    setBusy(false);
    if (!res.ok) { toast(res.message, "error"); return; }
    setMe(res.data);
    setNumber("");
    setFile(null);
    toast(`${info.label} submitted for verification`, "success");
  };

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-0 md:flex-row md:items-start" style={{ borderColor: "var(--a-border)" }}>
      <div className="min-w-0 md:w-64">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{info.label}</p>
          {doc ? <StatusPill tone={KYC_STATUS_META[doc.status].tone}>{KYC_STATUS_META[doc.status].label}</StatusPill> : info.required ? <StatusPill tone="muted">Required</StatusPill> : null}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{info.help}</p>
        {doc?.numberMasked && <p className="mt-1 font-mono text-xs" style={{ color: "var(--a-fg)" }}>{doc.numberMasked}</p>}
        {doc?.fileName && <p className="mt-1 truncate text-xs" style={{ color: "var(--a-muted)" }}>File: {doc.fileName}</p>}
        {doc?.status === "rejected" && doc.note && <p className="mt-1 text-xs text-rose-600">Reason: {doc.note}</p>}
      </div>
      {locked ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700"><Lock size={14} />Verified. Contact support to change it.</p>
      ) : (
        <div className="flex flex-1 flex-wrap items-end gap-3">
          {info.needsNumber && (
            <div className="w-56"><Field label={info.needsNumber === "pan" ? "PAN number" : "Aadhaar number"}>
              <AdminInput value={number} onChange={(e) => setNumber(info.needsNumber === "pan" ? e.target.value.toUpperCase().slice(0, 10) : e.target.value.replace(/[^\d ]/g, "").slice(0, 14))} placeholder={info.needsNumber === "pan" ? "ABCDE1234F" : "XXXX XXXX XXXX"} autoComplete="off" />
            </Field></div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
            <FileUp size={15} /><span className="max-w-44 truncate">{file ? file.name : info.needsNumber ? "Attach copy (optional)" : "Choose file"}</span>
            <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <AdminButton onClick={submit} disabled={busy}>{busy ? "Uploading…" : doc ? "Resubmit" : "Submit"}</AdminButton>
        </div>
      )}
    </div>
  );
}

function PayoutForm() {
  const { me, setMe } = usePartner();
  const { toast } = useAdminToast();
  const [method, setMethod] = useState<"bank" | "upi">(me?.payout?.method ?? "bank");
  const [f, setF] = useState({ accountHolder: me?.payout?.accountHolder ?? me?.legalName ?? "", accountNumber: "", confirm: "", ifsc: "", bankName: "", upiId: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (method === "bank") {
      if (!/^\d{9,18}$/.test(f.accountNumber)) return toast("Account number must be 9-18 digits", "error");
      if (f.accountNumber !== f.confirm) return toast("Account numbers do not match", "error");
      if (!IFSC_RE.test(f.ifsc.toUpperCase())) return toast("Enter a valid IFSC, e.g. HDFC0001234", "error");
    } else if (!UPI_RE.test(f.upiId)) return toast("Enter a valid UPI ID, e.g. name@okhdfc", "error");
    setBusy(true);
    const res = await partnerApi.setPayoutAccount(method === "bank"
      ? { method, accountHolder: f.accountHolder, accountNumber: f.accountNumber, ifsc: f.ifsc.toUpperCase(), bankName: f.bankName }
      : { method, accountHolder: f.accountHolder, upiId: f.upiId.trim().toLowerCase() });
    setBusy(false);
    if (!res.ok) return toast(res.message, "error");
    setMe(res.data);
    setF((p) => ({ ...p, accountNumber: "", confirm: "" }));
    toast("Payout account saved. It will be verified with your bank proof.", "success");
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Payout account</p>
          {me?.payout ? (
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              Current: {me.payout.method === "bank" ? `${me.payout.bankName} · ${me.payout.accountNumberMasked} · ${me.payout.ifsc}` : me.payout.upiId}{" "}
              <StatusPill tone={me.payout.verified ? "green" : "gold"}>{me.payout.verified ? "Verified" : "Awaiting verification"}</StatusPill>
            </p>
          ) : <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Where your earnings will be sent.</p>}
        </div>
        <SegmentedControl options={[{ value: "bank", label: "Bank account" }, { value: "upi", label: "UPI" }]} value={method} onChange={setMethod} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account holder name" hint="Must match your PAN"><AdminInput value={f.accountHolder} onChange={(e) => set("accountHolder", e.target.value)} maxLength={120} /></Field>
        {method === "bank" ? (
          <>
            <Field label="Bank name"><AdminInput value={f.bankName} onChange={(e) => set("bankName", e.target.value)} maxLength={120} /></Field>
            <Field label="Account number"><AdminInput inputMode="numeric" autoComplete="off" value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value.replace(/\D/g, "").slice(0, 18))} /></Field>
            <Field label="Confirm account number"><AdminInput inputMode="numeric" autoComplete="off" value={f.confirm} onChange={(e) => set("confirm", e.target.value.replace(/\D/g, "").slice(0, 18))} onPaste={(e) => e.preventDefault()} /></Field>
            <Field label="IFSC"><AdminInput value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase().slice(0, 11))} placeholder="HDFC0001234" /></Field>
          </>
        ) : (
          <Field label="UPI ID"><AdminInput value={f.upiId} onChange={(e) => set("upiId", e.target.value.trim())} placeholder="name@okhdfc" autoComplete="off" /></Field>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><ShieldCheck size={14} />Stored securely. Changing it pauses payouts until it is verified again.</p>
        <AdminButton onClick={save} disabled={busy}>{busy ? "Saving…" : "Save payout account"}</AdminButton>
      </div>
    </Card>
  );
}

export default function KycPage() {
  return <Suspense fallback={<StatsSkeleton count={3} />}><KycInner /></Suspense>;
}

function KycInner() {
  const { me } = usePartner();
  const welcome = useSearchParams().get("welcome") === "1";
  if (!me) return <StatsSkeleton count={3} />;
  return (
    <div className="space-y-6">
      <PageHeader title="KYC & payout" subtitle="Verified documents keep customers safe and let us pay you." />
      {welcome && me.status === "applied" && (
        <Card className="p-4 text-sm" style={{ color: "var(--a-fg)" }}>Thank you for applying. Upload your PAN, Aadhaar and bank proof below. Your profile goes for review as soon as all three are submitted.</Card>
      )}
      <Card className="px-5 py-1">{KYC_DOC_TYPES.map((t) => <DocRow key={t} type={t} />)}</Card>
      <PayoutForm />
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>Documents are stored privately and are only seen by our verification team. Aadhaar: only the last 4 digits are kept.</p>
    </div>
  );
}
