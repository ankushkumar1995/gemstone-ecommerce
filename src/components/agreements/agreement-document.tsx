"use client";

/**
 * Signed partner agreement, A4 and print-ready (Save as PDF from the print
 * dialog). Renders the EXACT version text the partner signed, the electronic
 * acceptance certificate, and a live integrity check. Used by the partner
 * panel and the admin panel (admin also sees full IP / user agent / void info).
 */

import Link from "next/link";
import { ArrowLeft, Download, Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AgreementAcceptance, PartnerAcceptanceView, PartnerAgreementView } from "@/modules/agreements/agreement.types";
import { PLATFORM } from "@/app/astrologer/_components/legal";

const INK = "#16122b";
const GOLD = "#b8892a";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });

const METHOD: Record<AgreementAcceptance["method"], string> = {
  typed_name_sms_otp: "Typed full legal name + one-time password by SMS to the registered mobile",
  typed_name_email_otp: "Typed full legal name + one-time password by email to the registered email",
};

export function AgreementDocument({
  agreement,
  acceptance,
  verified,
  backHref,
  backLabel,
  pdfHref,
}: {
  agreement: PartnerAgreementView;
  acceptance: PartnerAcceptanceView | AgreementAcceptance;
  verified: { textIntact: boolean; fingerprintIntact: boolean };
  backHref: string;
  backLabel: string;
  /** Server-generated PDF (the archived copy when available). */
  pdfHref?: string;
}) {
  const a = acceptance;
  const full = "ip" in a ? (a as AgreementAcceptance) : null;
  const intact = verified.textIntact && verified.fingerprintIntact;

  return (
    <div className="agr-root min-h-screen bg-[#e9ebf1] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"><ArrowLeft size={15} /> {backLabel}</Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
            <Printer size={16} /> Print
          </button>
          {pdfHref && (
            <a href={pdfHref} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5" style={{ background: `linear-gradient(135deg, ${GOLD}, #e2b65a)` }}>
              <Download size={16} /> Download PDF
            </a>
          )}
        </div>
      </div>

      {/* integrity banner (screen only) */}
      <div className="mx-auto mb-4 max-w-[210mm] px-4 print:hidden" role="status">
        {intact ? (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"><ShieldCheck size={16} /> Verified: this is the exact text that was signed, and the signature record is unchanged.</p>
        ) : (
          <p className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"><ShieldAlert size={16} /> Integrity check failed: {verified.textIntact ? "the signature record" : "the agreement text"} does not match what was signed. Contact support.</p>
        )}
        {a.voided && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">This signature was voided{a.voidReason ? `: ${a.voidReason}` : ""}. It is kept for the record only.</p>}
      </div>

      <article className="relative mx-auto w-[210mm] max-w-full bg-white shadow-[0_30px_80px_-40px_rgba(22,18,43,0.55)] print:shadow-none" style={{ color: "#3f3a52" }}>
        {a.voided && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            <span className="-rotate-[28deg] select-none font-serif text-[110px] font-bold tracking-[0.2em] text-rose-600/10">VOID</span>
          </div>
        )}
        <header className="relative px-14 pb-8 pt-10" style={{ background: `linear-gradient(120deg, ${INK}, #2a1f52 60%, #3a2a66)`, color: "#f5efe1" }}>
          <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, #f0cf83, ${GOLD}, transparent)` }} />
          <p className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "#d9bf86" }}>Astrounkle Partner Programme</p>
          <h1 className="mt-2 font-serif text-[28px] tracking-wide">{agreement.title}</h1>
          <p className="mt-1 text-[12px]" style={{ color: "#cdbf9e" }}>
            Version {agreement.version} · Effective {fmtDate(agreement.effectiveFrom)} · Between {PLATFORM.legalName} and {a.signer.legalName}
          </p>
        </header>

        <div className="space-y-5 px-14 py-10 text-[12.5px] leading-[1.75]">
          {agreement.clauses.map((c) => (
            <section key={c.id} className="break-inside-avoid">
              <h2 className="font-serif text-[15px] font-semibold" style={{ color: INK }}>{c.heading}</h2>
              <p className="mt-1 whitespace-pre-line text-zinc-600">{c.body}</p>
            </section>
          ))}
          {agreement.keyPoints.length > 0 && (
            <section className="break-inside-avoid">
              <h2 className="font-serif text-[15px] font-semibold" style={{ color: INK }}>Confirmed by the partner</h2>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-600">
                {agreement.keyPoints.map((k) => <li key={k.id}>{k.text}{a.keyPointsAccepted.includes(k.id) ? " ✓" : ""}</li>)}
              </ul>
            </section>
          )}
        </div>

        <section className="mx-14 mb-12 break-inside-avoid rounded-xl p-6" style={{ border: "1px solid #e6d6ae", background: "linear-gradient(160deg,#fbf7ee,#f4ecda)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Electronic acceptance certificate</p>
          <dl className="mt-3 grid grid-cols-[11rem_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-zinc-500">Certificate no.</dt><dd className="font-mono font-semibold" style={{ color: INK }}>{a.certificateNo}</dd>
            <dt className="text-zinc-500">Signed by</dt><dd className="font-semibold" style={{ color: INK }}>{a.typedName} <span className="font-normal text-zinc-500">(KYC name: {a.signer.legalName})</span></dd>
            <dt className="text-zinc-500">Partner</dt><dd style={{ color: INK }}>{a.signer.displayName} · {a.signer.email}{a.signer.phoneMasked ? ` · ${a.signer.phoneMasked}` : ""}</dd>
            <dt className="text-zinc-500">Signed on</dt><dd style={{ color: INK }}>{fmt(a.signedAt)}</dd>
            <dt className="text-zinc-500">Method</dt>
            <dd style={{ color: INK }}>{METHOD[a.method]} ({a.otp.destinationMasked}){!a.otp.delivered && <span className="text-rose-600"> · TEST MODE: OTP was not delivered by a provider</span>}</dd>
            <dt className="text-zinc-500">Device</dt><dd style={{ color: INK }}>{a.device}</dd>
            <dt className="text-zinc-500">IP address</dt><dd style={{ color: INK }}>{full ? full.ip : a.ipMasked}</dd>
            {full && <><dt className="text-zinc-500">User agent</dt><dd className="break-all text-[10.5px]" style={{ color: INK }}>{full.userAgent || "–"}</dd></>}
            <dt className="text-zinc-500">Reading evidence</dt><dd style={{ color: INK }}>{a.evidence.scrolledToEnd ? "Scrolled to the end" : "Not recorded"} · {Math.round(a.evidence.secondsOnPage / 60)} min {a.evidence.secondsOnPage % 60} s on page</dd>
            <dt className="text-zinc-500">Text fingerprint</dt><dd className="break-all font-mono text-[10.5px]" style={{ color: INK }}>SHA-256 {a.contentHash}</dd>
            <dt className="text-zinc-500">Signature fingerprint</dt><dd className="break-all font-mono text-[10.5px]" style={{ color: INK }}>SHA-256 {a.fingerprint}</dd>
            {a.prevFingerprint && <><dt className="text-zinc-500">Previous signature</dt><dd className="break-all font-mono text-[10.5px]" style={{ color: INK }}>{a.prevFingerprint}</dd></>}
            {a.voided && <><dt className="text-rose-600">Voided</dt><dd className="text-rose-700">{a.voidedAt ? fmt(a.voidedAt) : ""}{full?.voidedBy ? ` by ${full.voidedBy}` : ""}{a.voidReason ? ` · ${a.voidReason}` : ""}</dd></>}
          </dl>
          <p className="mt-4 text-[10.5px] text-zinc-500">
            Accepted electronically: a valid electronic contract under section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872.
            Any change to the text above changes its fingerprint.
          </p>
        </section>

        <footer className="flex flex-wrap justify-between gap-2 px-14 py-4 text-[10px] text-zinc-400" style={{ borderTop: "1px solid #efe9dc", background: "#fcfaf5" }}>
          <span>{PLATFORM.legalName} · CIN {PLATFORM.cin}</span><span>{PLATFORM.email}</span>
        </footer>
      </article>
      <style jsx global>{`
        .agr-root, .agr-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .agr-root, .agr-root * { visibility: visible; }
          .agr-root { position: absolute; inset: 0 auto auto 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
