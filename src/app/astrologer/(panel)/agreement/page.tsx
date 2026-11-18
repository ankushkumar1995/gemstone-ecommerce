"use client";

/**
 * Partner agreement e-sign. Everything is checked again on the server:
 *   1. Read the current version to the end
 *   2. Tick every key point
 *   3. Type the full legal name (must match KYC)
 *   4. OTP by SMS to the registered mobile → sign
 * The server stores the signature with version, text hash, time, typed name,
 * device, IP and a fingerprint. Signed copies come from the server too.
 *
 * OTP rules (server): 6 digits, valid 5 min, resend after 30 s, max 5 an hour,
 * 3 wrong tries lock signing for 10 min.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Download, FileSignature, FlaskConical, Lock, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, PageHeader, StatsSkeleton, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";
import type { OtpSendResult, PartnerAgreementState } from "@/modules/agreements/agreement.types";
import { usePartner } from "../../_components/partner-context";
import { fmtDateTime, nowMs } from "../../_components/demo";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();
const istDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Otp = Pick<OtpSendResult, "challengeId" | "channel" | "destinationMasked" | "expiresAt"> & { devCode?: string; delivered?: boolean };

export default function AgreementPage() {
  const { reloadAgreement } = usePartner();
  const { toast } = useAdminToast();
  const [st, setSt] = useState<PartnerAgreementState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readAll, setReadAll] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [otp, setOtp] = useState<Otp | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [code, setCode] = useState("");
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<"otp" | "sign" | null>(null);
  const [now, setNow] = useState(0);
  const openedAt = useRef(0);
  const codeRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await partnerApi.agreement.state();
    if (!r.ok) { setLoadError(r.message); return; }
    setSt(r.data);
    setLoadError(null);
    // Resume an OTP that is still open (e.g. after a page refresh).
    if (r.data.otp.pending) setOtp((o) => o ?? { ...r.data.otp.pending! });
    setResendAt(r.data.otp.resendAt ? Date.parse(r.data.otp.resendAt) : 0);
    setLockedUntil(r.data.otp.lockedUntil ? Date.parse(r.data.otp.lockedUntil) : 0);
  }, []);

  useOnMount(() => { openedAt.current = nowMs(); void load(); });
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), 1000);
    const first = setTimeout(() => setNow(nowMs()), 0);
    return () => { clearInterval(id); clearTimeout(first); };
  }, []);

  if (loadError) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <AlertTriangle className="text-rose-600" size={20} />
        <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}>{loadError}</p>
        <AdminButton variant="outline" onClick={() => void load()}><RefreshCw size={15} /> Try again</AdminButton>
      </Card>
    );
  }
  if (!st || !now) return <StatsSkeleton count={2} />;

  const cur = st.current;
  const signed = st.signature;
  const locked = lockedUntil > now;
  const allChecked = !!cur && cur.keyPoints.every((k) => checks[k.id]);
  const nameOk = norm(name) === norm(st.legalName);
  const ready = !!cur && readAll && allChecked && nameOk && !locked;
  const otpLive = otp && Date.parse(otp.expiresAt) > now;
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const payload = () => ({
    agreementId: cur!.id,
    contentHash: cur!.contentHash as string,
    typedName: name.trim(),
    keyPoints: cur!.keyPoints.filter((k) => checks[k.id]).map((k) => k.id),
    scrolledToEnd: true as const,
  });

  /** Server said the text changed: start over on the new version. */
  const handleReason = async (details: unknown, message: string) => {
    const reason = (details as { reason?: string; until?: string; triesLeft?: number } | undefined)?.reason;
    const d = details as { until?: string; triesLeft?: number } | undefined;
    if (reason === "VERSION_CHANGED") {
      toast("A newer version was published. Please read it again.", "info");
      setReadAll(false); setScrollPct(0); setChecks({}); setOtp(null); setCode("");
      await load();
      return;
    }
    if (reason === "LOCKED" && d?.until) { setLockedUntil(Date.parse(d.until)); setOtp(null); setCode(""); }
    if (reason === "WRONG_OTP" && typeof d?.triesLeft === "number") setTriesLeft(d.triesLeft);
    if (reason === "OTP_EXPIRED" || reason === "OTP_USED" || reason === "OTP_INVALID") { setOtp(null); setCode(""); }
    if (reason === "ALREADY_SIGNED") await load();
    toast(message, "error");
  };

  const sendOtp = async () => {
    if (!ready || busy || resendIn > 0) return;
    setBusy("otp");
    const r = await partnerApi.agreement.sendOtp(payload());
    setBusy(null);
    if (!r.ok) return handleReason(r.details, r.message);
    setOtp({ challengeId: r.data.challengeId, channel: r.data.channel, destinationMasked: r.data.destinationMasked, expiresAt: r.data.expiresAt, devCode: r.data.devCode, delivered: r.data.delivered });
    setResendAt(Date.parse(r.data.resendAt));
    setCode(""); setTriesLeft(null);
    toast(r.data.delivered ? `OTP sent to ${r.data.destinationMasked}` : "Test mode: OTP shown on screen", "success");
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const sign = async () => {
    if (!otp || code.length !== 6 || busy || !ready) return;
    setBusy("sign");
    const r = await partnerApi.agreement.sign({ ...payload(), challengeId: otp.challengeId, code, secondsOnPage: Math.round((nowMs() - openedAt.current) / 1000) });
    setBusy(null);
    if (!r.ok) return handleReason(r.details, r.message);
    toast(`Agreement v${r.data.version} signed. Certificate ${r.data.certificateNo}`, "success");
    setOtp(null); setCode(""); setName(""); setChecks({});
    await Promise.all([load(), reloadAgreement()]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner agreement"
        subtitle={cur ? `${cur.title} · Version ${cur.version} · effective ${istDate(cur.effectiveFrom).split(",")[0]}` : "Partner Services Agreement"}
      />

      {!cur && (
        <Card className="p-6 text-center">
          <FileSignature size={28} className="mx-auto" style={{ color: "var(--a-gold)" }} />
          <p className="mt-2 font-semibold" style={{ color: "var(--a-fg)" }}>No agreement to sign right now</p>
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>When a new version is published you will see it here.</p>
        </Card>
      )}

      {/* ---------- status ---------- */}
      {cur && signed && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/12"><CheckCircle2 size={26} className="text-emerald-600" /></span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>You signed version {signed.version} on {istDate(signed.signedAt)} IST</p>
            <p style={{ color: "var(--a-muted)" }}>Signed as “{signed.typedName}” with OTP to {signed.otp.destinationMasked} · {signed.device} · IP {signed.ipMasked}</p>
            <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--a-faint)" }}>Certificate {signed.certificateNo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/astrologer/agreement-copy/${signed.id}`} target="_blank"><AdminButton variant="outline">View signed copy</AdminButton></Link>
            <a href={`/api/v1/astrologer/agreement/acceptances/${signed.id}/pdf`}><AdminButton><Download size={15} /> Download PDF</AdminButton></a>
          </div>
        </Card>
      )}

      {cur && !signed && (
        <Card className={cn("p-5", st.gate === "blocked" && "border-rose-300")}>
          <div className="flex items-start gap-3">
            {st.gate === "blocked"
              ? <Lock size={18} className="mt-0.5 shrink-0 text-rose-600" />
              : <Clock size={18} className="mt-0.5 shrink-0" style={{ color: "var(--a-gold)" }} />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold" style={{ color: st.gate === "blocked" ? "#be123c" : "var(--a-fg)" }}>
                {st.gate === "blocked" ? st.reason : `Please sign version ${cur.version} by ${st.deadline ? istDate(st.deadline) : ""} IST`}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                {st.gate === "blocked"
                  ? "You can use the panel, but you cannot go online until you sign."
                  : `Until then you can work as usual. After the deadline you cannot go online until you sign.${st.extendedUntil ? " Your deadline was extended by our team." : ""}`}
              </p>
              {cur.changes.length > 0 && (
                <>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>What changed in this version</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" style={{ color: "var(--a-fg)" }}>{cur.changes.map((c) => <li key={c}>{c}</li>)}</ul>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ---------- text ---------- */}
      {cur && (
        <Card className="p-0">
          {!signed && (
            <div className="flex items-center gap-3 border-b px-6 py-2.5" style={{ borderColor: "var(--a-border)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--a-muted)" }}>Step 1 · Read the agreement</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${readAll ? 100 : scrollPct}%`, background: readAll ? "#059669" : "var(--a-gold)" }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: readAll ? "#059669" : "var(--a-faint)" }}>{readAll ? "Read" : `${scrollPct}%`}</span>
            </div>
          )}
          <div
            className="max-h-[460px] space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-gold)]"
            tabIndex={0}
            role="document"
            aria-label={`Partner agreement version ${cur.version}`}
            onScroll={(e) => {
              const el = e.currentTarget;
              const pct = el.scrollHeight <= el.clientHeight ? 100 : Math.min(100, Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100));
              setScrollPct(pct);
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReadAll(true);
            }}
          >
            {cur.clauses.map((c) => (
              <section key={c.id}>
                <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>{c.heading}</h2>
                <p className="whitespace-pre-line" style={{ color: "var(--a-muted)" }}>{c.body}</p>
              </section>
            ))}
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>End of agreement v{cur.version}. Text fingerprint {cur.contentHash?.slice(0, 16)}…</p>
          </div>
          {!readAll && !signed && <p className="border-t px-6 py-2 text-xs" style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}>Scroll to the end to continue.</p>}
        </Card>
      )}

      {/* ---------- sign ---------- */}
      {cur && !signed && (
        <Card className="space-y-5 p-5">
          <fieldset disabled={!readAll} className={cn("space-y-2.5", !readAll && "opacity-50")}>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>Step 2 · Confirm you understand</legend>
            {cur.keyPoints.map((k) => (
              <label key={k.id} className="flex cursor-pointer items-start gap-2.5 text-sm" style={{ color: "var(--a-fg)" }}>
                <input type="checkbox" checked={!!checks[k.id]} onChange={(e) => setChecks({ ...checks, [k.id]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--a-gold)]" />
                {k.text}
              </label>
            ))}
          </fieldset>

          <fieldset disabled={!readAll || !allChecked} className={cn(!(readAll && allChecked) && "opacity-50")}>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>Step 3 · Sign with your name</legend>
            <Field label="Type your full legal name" hint={`It must match your KYC name: ${st.legalName}`}>
              <AdminInput value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} autoComplete="name" aria-invalid={!!name && !nameOk} />
            </Field>
            {name && !nameOk && <p className="mt-1 text-xs text-rose-700">The name does not match your KYC name. If your KYC name is wrong, contact support.</p>}
            {name && nameOk && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> Name matches</p>}
          </fieldset>

          <div className={cn("space-y-3", !(readAll && allChecked && nameOk) && "opacity-50")}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>Step 4 · Verify with OTP</p>
            {locked ? (
              <p className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700"><Lock size={15} /> Signing is locked for {Math.ceil((lockedUntil - now) / 60000)} min after too many wrong OTPs.</p>
            ) : otpLive ? (
              <>
                {otp.devCode && (
                  <p className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs" style={{ borderColor: "var(--a-gold)", color: "var(--a-fg)" }} role="note">
                    <FlaskConical size={14} className="mt-0.5 shrink-0" style={{ color: "var(--a-gold)" }} />
                    <span>Test mode: the SMS service is not connected yet, so the OTP is shown here: <b className="font-mono tracking-widest">{otp.devCode}</b>. Once SMS is connected, it comes by SMS only.</span>
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={`OTP sent to ${otp.destinationMasked}${otp.channel === "email" ? " (email)" : ""}`} hint={`Expires in ${Math.max(0, Math.ceil((Date.parse(otp.expiresAt) - now) / 1000))} s${triesLeft !== null ? ` · ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left` : ""}`}>
                    <AdminInput
                      ref={codeRef}
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === "Enter") void sign(); }}
                      autoComplete="one-time-code"
                      aria-label="6-digit OTP"
                      className="w-40 text-center font-mono tracking-[0.4em]"
                    />
                  </Field>
                  <AdminButton onClick={sign} disabled={code.length !== 6 || busy !== null || !ready}><ShieldCheck size={15} /> {busy === "sign" ? "Signing…" : "Sign agreement"}</AdminButton>
                  <AdminButton variant="ghost" onClick={sendOtp} disabled={resendIn > 0 || busy !== null}>{resendIn > 0 ? `Resend in ${resendIn} s` : "Resend OTP"}</AdminButton>
                </div>
              </>
            ) : (
              <AdminButton onClick={sendOtp} disabled={!ready || busy !== null || resendIn > 0}>
                <Smartphone size={15} /> {busy === "otp" ? "Sending…" : resendIn > 0 ? `Send OTP in ${resendIn} s` : `Send OTP to ${st.phoneMasked}`}
              </AdminButton>
            )}
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: "var(--a-faint)" }}>
            Typing your name and entering the OTP is your electronic acceptance, a valid e-contract under section 10A of the Information Technology Act, 2000.
            We record the version, the time, your typed name, your device, your IP address and a fingerprint of this exact text. You get a signed copy by email.
          </p>
        </Card>
      )}

      {/* ---------- history ---------- */}
      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Signature history</p>
        {st.history.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--a-faint)" }}>You have not signed any version yet.</p>
        ) : (
          <ul className="divide-y text-sm" style={{ borderColor: "var(--a-border)" }}>
            {st.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span style={{ color: "var(--a-fg)" }}>Version {h.version}</span>
                  <span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(h.signedAt)} · {h.device} · <span className="font-mono">{h.certificateNo}</span></span>
                  {h.voided && h.voidReason && <span className="block text-xs text-rose-700">Voided: {h.voidReason}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {h.voided ? <Badge tone="rose">Void</Badge> : cur && h.agreementId === cur.id ? <Badge tone="green">Current</Badge> : <Badge tone="muted">Older</Badge>}
                  <Link href={`/astrologer/agreement-copy/${h.id}`} target="_blank" className="text-xs font-medium" style={{ color: "var(--a-gold)" }}>Copy</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
