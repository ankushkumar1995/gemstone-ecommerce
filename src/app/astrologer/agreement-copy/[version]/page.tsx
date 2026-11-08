"use client";

/**
 * Signed copy of the partner agreement (A4, print to PDF) with the signature
 * certificate: version, signer, time, method, device, masked IP, fingerprint.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { agreementStore, useStore } from "../../_components/demo-store";
import { AGREEMENT } from "../../_components/agreement-text";
import { PLATFORM } from "../../_components/legal";

const INK = "#16122b";
const GOLD = "#b8892a";

export default function AgreementCopyPage() {
  const { version } = useParams<{ version: string }>();
  const list = useStore(agreementStore);
  const a = list.find((x) => x.version === version);

  if (!a) {
    return <div className="flex min-h-screen items-center justify-center gap-2 bg-[#e9ebf1] text-sm text-zinc-600">No signed copy for version {version}. <Link className="underline" href="/astrologer/agreement">Back</Link></div>;
  }
  const signed = new Date(a.acceptedAt).toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });

  return (
    <div className="agr-root min-h-screen bg-[#e9ebf1] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[210mm] items-center justify-between px-4 print:hidden">
        <Link href="/astrologer/agreement" className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"><ArrowLeft size={15} /> Partner agreement</Link>
        <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${GOLD}, #e2b65a)` }}><Download size={16} /> Download PDF</button>
      </div>
      <article className="relative mx-auto w-[210mm] max-w-full bg-white shadow-[0_30px_80px_-40px_rgba(22,18,43,0.55)] print:shadow-none" style={{ color: "#3f3a52" }}>
        <header className="relative px-14 pb-8 pt-10" style={{ background: `linear-gradient(120deg, ${INK}, #2a1f52 60%, #3a2a66)`, color: "#f5efe1" }}>
          <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, #f0cf83, ${GOLD}, transparent)` }} />
          <p className="text-[10px] uppercase tracking-[0.32em]" style={{ color: "#d9bf86" }}>Astrounkle Partner Programme</p>
          <h1 className="mt-2 font-serif text-[28px] tracking-wide">Partner Services Agreement</h1>
          <p className="mt-1 text-[12px]" style={{ color: "#cdbf9e" }}>Version {AGREEMENT.version} · Effective {AGREEMENT.effective} · Between {PLATFORM.legalName} and {a.name}</p>
        </header>
        <div className="space-y-5 px-14 py-10 text-[12.5px] leading-[1.75]">
          {AGREEMENT.clauses.map((c) => (
            <section key={c.h} className="break-inside-avoid">
              <h2 className="font-serif text-[15px] font-semibold" style={{ color: INK }}>{c.h}</h2>
              <p className="mt-1 text-zinc-600">{c.p}</p>
            </section>
          ))}
        </div>
        <section className="mx-14 mb-12 break-inside-avoid rounded-xl p-6" style={{ border: "1px solid #e6d6ae", background: "linear-gradient(160deg,#fbf7ee,#f4ecda)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Electronic signature certificate</p>
          <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-zinc-500">Signed by</dt><dd className="font-semibold" style={{ color: INK }}>{a.name}</dd>
            <dt className="text-zinc-500">Signed on</dt><dd style={{ color: INK }}>{signed}</dd>
            <dt className="text-zinc-500">Method</dt><dd style={{ color: INK }}>Typed full name + one-time password to registered mobile</dd>
            <dt className="text-zinc-500">Device</dt><dd style={{ color: INK }}>{a.device}</dd>
            <dt className="text-zinc-500">IP address</dt><dd style={{ color: INK }}>{a.ipMasked}</dd>
            <dt className="text-zinc-500">Document fingerprint</dt><dd className="break-all font-mono text-[10.5px]" style={{ color: INK }}>SHA-256 {a.fingerprint}</dd>
          </dl>
          <p className="mt-4 text-[10.5px] text-zinc-500">This record is an electronic signature under the Information Technology Act, 2000. Any change to the text above changes its fingerprint.</p>
        </section>
        <footer className="flex justify-between px-14 py-4 text-[10px] text-zinc-400" style={{ borderTop: "1px solid #efe9dc", background: "#fcfaf5" }}>
          <span>{PLATFORM.legalName} · CIN {PLATFORM.cin}</span><span>{PLATFORM.email}</span>
        </footer>
      </article>
      <style jsx global>{`
        .agr-root, .agr-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { @page { size: A4; margin: 0; } html, body { background: #fff !important; } }
      `}</style>
    </div>
  );
}
