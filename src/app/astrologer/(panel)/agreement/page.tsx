"use client";

/**
 * Partner agreement e-sign (DEMO OTP). Steps: read to the end → confirm key
 * points → type your legal name exactly → OTP on your registered mobile →
 * signed. Each acceptance stores version, time, typed name, method, masked IP,
 * device and a SHA-256 fingerprint of the exact text, and can be downloaded.
 *
 * OTP rules: 6 digits, valid 5 minutes, resend after 30 s, 3 wrong tries lock
 * signing for 10 minutes.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileSignature, Lock, ShieldCheck } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { fmtDateTime, nowMs } from "../../_components/demo";
import { agreementStore, useStore } from "../../_components/demo-store";
import { AGREEMENT, agreementText, deviceLabel } from "../../_components/agreement-text";
import { sha256Hex } from "../../_components/legal";

const OTP_TTL = 5 * 60_000;
const RESEND_MS = 30_000;
const LOCK_MS = 10 * 60_000;
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export default function AgreementPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const accepted = useStore(agreementStore);
  const [readAll, setReadAll] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);
  const [name, setName] = useState("");
  const [otp, setOtp] = useState<{ code: string; sentAt: number } | null>(null);
  const [code, setCode] = useState("");
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const id = setInterval(() => setNow(nowMs()), 1000); const f = setTimeout(() => setNow(nowMs()), 0); return () => { clearInterval(id); clearTimeout(f); }; }, []);

  if (loading || !me || !now) return <StatsSkeleton count={2} />;
  const current = accepted.find((a) => a.version === AGREEMENT.version);
  const legal = me.legalName || me.displayName;
  const nameOk = norm(name) === norm(legal);
  const phoneMasked = me.phone ? `••••••${me.phone.slice(-4)}` : "your mobile";
  const locked = lockedUntil > now;
  const ready = readAll && checks.every(Boolean) && nameOk && !locked;

  const sendOtp = () => {
    if (!ready) return;
    if (otp && now - otp.sentAt < RESEND_MS) return;
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setOtp({ code: c, sentAt: nowMs() });
    setCode("");
    toast(`Demo OTP sent to ${phoneMasked}: ${c}`, "info");
  };

  const sign = async () => {
    if (!otp || !ready || busy) return;
    if (now - otp.sentAt > OTP_TTL) { setOtp(null); return toast("OTP expired. Send a new one.", "error"); }
    if (code !== otp.code) {
      const t = tries + 1;
      setTries(t);
      if (t >= 3) { setLockedUntil(nowMs() + LOCK_MS); setOtp(null); setTries(0); return toast("Too many wrong OTPs. Try again in 10 minutes.", "error"); }
      return toast(`Wrong OTP. ${3 - t} tries left.`, "error");
    }
    setBusy(true);
    const at = new Date(nowMs()).toISOString();
    const fingerprint = await sha256Hex(`${agreementText()}\n--\n${legal}\n${me.id}\n${at}`);
    agreementStore.set((l) => [{ version: AGREEMENT.version, acceptedAt: at, name: name.trim(), method: "typed_name_otp", ipMasked: "49.36.xx.xx", device: deviceLabel(navigator.userAgent), fingerprint }, ...l]);
    setBusy(false);
    setOtp(null);
    toast(`Agreement v${AGREEMENT.version} signed`, "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Partner agreement" subtitle={`Version ${AGREEMENT.version} · effective ${AGREEMENT.effective}`} />

      {current ? (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <CheckCircle2 size={28} className="text-emerald-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>You signed version {current.version} on {fmtDateTime(current.acceptedAt)}</p>
            <p style={{ color: "var(--a-muted)" }}>Signed as “{current.name}” with OTP · {current.device} · IP {current.ipMasked}</p>
            <p className="mt-1 break-all font-mono text-[11px]" style={{ color: "var(--a-faint)" }}>Fingerprint {current.fingerprint}</p>
          </div>
          <Link href={`/astrologer/agreement-copy/${current.version}`} target="_blank"><AdminButton variant="outline"><Download size={15} /> Signed copy (PDF)</AdminButton></Link>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><FileSignature size={16} /> Please sign version {AGREEMENT.version} by {AGREEMENT.deadline}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>After the deadline you can still use the panel, but you cannot go online until you sign.</p>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm" style={{ color: "var(--a-fg)" }}>{AGREEMENT.changes.map((c) => <li key={c}>{c}</li>)}</ul>
        </Card>
      )}

      <Card className="p-0">
        <div ref={boxRef} className="max-h-[420px] space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed" tabIndex={0} aria-label="Agreement text"
          onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReadAll(true); }}>
          {AGREEMENT.clauses.map((c) => (
            <section key={c.h}><h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>{c.h}</h2><p style={{ color: "var(--a-muted)" }}>{c.p}</p></section>
          ))}
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>End of agreement v{AGREEMENT.version}.</p>
        </div>
        {!readAll && !current && <p className="border-t px-6 py-2 text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}>Scroll to the end to continue.</p>}
      </Card>

      {!current && (
        <Card className="space-y-4 p-5">
          {[
            "I am an independent professional and set my own hours.",
            "I will not share contact details or take payments outside Astrounkle.",
            "I understand fees, the hold window, TDS and the strike policy.",
          ].map((t, i) => (
            <label key={t} className="flex items-start gap-2 text-sm" style={{ color: readAll ? "var(--a-fg)" : "var(--a-faint)" }}>
              <input type="checkbox" disabled={!readAll} checked={checks[i]} onChange={(e) => setChecks(checks.map((c, k) => (k === i ? e.target.checked : c)))} className="mt-1" />{t}
            </label>
          ))}
          <Field label="Type your full legal name to sign" hint={`Must match your KYC name: ${legal}`}>
            <AdminInput value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} disabled={!readAll} autoComplete="name" />
          </Field>
          {name && !nameOk && <p className="text-xs text-rose-700">The name does not match your KYC name.</p>}
          {locked ? (
            <p className="flex items-center gap-2 text-sm text-rose-700"><Lock size={15} /> Signing is locked for {Math.ceil((lockedUntil - now) / 60000)} min after 3 wrong OTPs.</p>
          ) : otp ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label={`OTP sent to ${phoneMasked}`} hint={`Expires in ${Math.max(0, Math.ceil((otp.sentAt + OTP_TTL - now) / 1000))} s`}>
                <AdminInput inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" className="w-40 tracking-[0.4em]" />
              </Field>
              <AdminButton onClick={sign} disabled={code.length !== 6 || busy}><ShieldCheck size={15} /> Sign agreement</AdminButton>
              <AdminButton variant="ghost" onClick={sendOtp} disabled={now - otp.sentAt < RESEND_MS}>{now - otp.sentAt < RESEND_MS ? `Resend in ${Math.ceil((otp.sentAt + RESEND_MS - now) / 1000)} s` : "Resend OTP"}</AdminButton>
            </div>
          ) : (
            <AdminButton onClick={sendOtp} disabled={!ready}>Send OTP to sign</AdminButton>
          )}
          <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Signing with OTP is an electronic signature under the IT Act, 2000. We record the time, your typed name, device, masked IP and a fingerprint of this exact text.</p>
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Signature history</p>
        {accepted.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No versions signed yet in this demo.</p> : (
          <ul className="divide-y text-sm" style={{ borderColor: "var(--a-border)" }}>
            {accepted.map((a) => (
              <li key={a.fingerprint} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span style={{ color: "var(--a-fg)" }}>Version {a.version}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(a.acceptedAt)} · {a.device}</span></span>
                <span className="flex items-center gap-2">{a.version === AGREEMENT.version ? <Badge tone="green">Current</Badge> : <Badge tone="muted">Older</Badge>}<Link href={`/astrologer/agreement-copy/${a.version}`} target="_blank" className="text-xs font-medium" style={{ color: "var(--a-gold)" }}>Copy</Link></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
