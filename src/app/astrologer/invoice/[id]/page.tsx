"use client";

/**
 * Monthly partner invoice + earnings statement (premium A4, print to PDF).
 *
 * Page 1  Tax invoice for the platform service fee (Astrounkle → partner),
 *         SAC, CGST+SGST (same state) or IGST (other state), amount in words.
 * Page 2  Earnings statement: what customers paid down to the net payout,
 *         with TDS, tips, gifts and remedy commission, and the bank reference.
 *
 * "Download PDF" uses the browser's Save as PDF with exact colours and A4
 * page size, so the PDF matches the screen pixel for pixel. Amounts are DEMO
 * until statements come from the ledger; the sheet carries a SPECIMEN mark.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import type { SelfAstrologer } from "@/modules/astrologers/astrologer.types";
import { partnerApi } from "@/lib/astrologer-api";
import { useOnMount } from "@/app/admin/_components";
import { taxProfileStore, useStore } from "../../_components/demo-store";
import { GIFT_SHARE_PCT, TIP_SHARE_PCT } from "../../_components/mock-data";
import { nowMs } from "../../_components/demo";
import { GST_RATE, GST_STATES, PLATFORM, buildStatements, inWords, sha256Hex, tdsRate, type MonthStatement } from "../../_components/legal";

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const INK = "#16122b";
const GOLD = "#b8892a";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const profile = useStore(taxProfileStore);
  const [me, setMe] = useState<SelfAstrologer | null>(null);
  const [now, setNow] = useState(0);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [print, setPrint] = useState("");

  useOnMount(() => {
    setNow(nowMs());
    void partnerApi.me().then((r) => { if (r.ok) { setMe(r.data); setState("ok"); } else setState("error"); });
  });

  const st: MonthStatement | undefined = useMemo(
    () => (me && now ? buildStatements(me.effectiveCommissionPct, profile, profile.stateCode, 12, now).find((s) => s.id === params.id) : undefined),
    [me, now, profile, params.id],
  );

  useEffect(() => {
    if (!st) return;
    document.title = `${st.id} · Astrounkle partner invoice`;
    let alive = true;
    void sha256Hex(JSON.stringify(st)).then((h) => { if (alive) setPrint(h); });
    return () => { alive = false; };
  }, [st]);

  if (state === "loading") return <Centered><Loader2 className="animate-spin" /> Preparing your invoice…</Centered>;
  if (state === "error" || !me) return <Centered>Please sign in again to view this invoice.</Centered>;
  if (!st) return <Centered>Invoice not found. <Link className="underline" href="/astrologer/tax">Back to Tax & invoices</Link></Centered>;

  const intra = st.igst === 0;
  const gst = st.cgst + st.sgst + st.igst;
  const total = Math.round((st.fee + gst) * 100) / 100;
  const pan = me.kyc.find((k) => k.type === "pan")?.numberMasked;
  const tds = tdsRate(profile);
  const partnerState = GST_STATES[profile.stateCode] ?? "—";
  const bank = me.payout ? (me.payout.method === "upi" ? `UPI ${me.payout.upiId ?? ""}` : `${me.payout.bankName ?? "Bank"} ${me.payout.accountNumberMasked ?? ""}`) : "Payout account not added";
  const utr = st.status === "paid" ? `HDFCN${st.month.replace("-", "")}${String(st.sessions).padStart(6, "0")}` : "Processing";
  const verifyCode = print ? print.slice(0, 24).toUpperCase().match(/.{1,4}/g)!.join("-") : "…";

  return (
    <div className="inv-root min-h-screen bg-[#e9ebf1] py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Link href="/astrologer/tax" className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"><ArrowLeft size={15} /> Tax & invoices</Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-zinc-500 md:inline">In the print window choose “Save as PDF”. Keep “Background graphics” on.</span>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${GOLD}, #e2b65a)` }}>
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* ========================= PAGE 1 · TAX INVOICE ========================= */}
      <Sheet>
        <Header title="Tax Invoice" subtitle="Original for recipient" id={st.id} />
        <div className="grid grid-cols-4 border-b" style={{ borderColor: "#ece7dc" }}>
          <Meta label="Invoice date" value={date(st.issuedAt)} />
          <Meta label="Billing period" value={st.label} />
          <Meta label="Place of supply" value={`${partnerState} (${profile.stateCode})`} />
          <Meta label="Status" value={<Pill paid={st.status === "paid"} />} last />
        </div>

        <div className="grid grid-cols-2 gap-6 px-12 py-8">
          <Party title="Issued by" lines={[PLATFORM.legalName, PLATFORM.address, `GSTIN ${PLATFORM.gstin}`, `PAN ${PLATFORM.pan} · CIN ${PLATFORM.cin}`]} />
          <Party title="Billed to" lines={[me.legalName || me.displayName, `Partner ID ${me.id.slice(-8).toUpperCase()} · ${me.displayName}`, profile.address || `${me.city ?? ""} ${partnerState}`.trim(), profile.gstRegistered && profile.gstin ? `GSTIN ${profile.gstin}` : "Unregistered (no GSTIN)", pan ? `PAN ${pan}` : "PAN on file"]} accent />
        </div>

        <div className="px-12">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr style={{ background: INK, color: "#f5efe1" }}>
                {["#", "Description of service", "SAC", "Taxable value", intra ? "CGST" : "IGST", intra ? "SGST" : "", "Amount"].map((h, i) => (
                  <th key={i} className={`px-3 py-2.5 font-semibold uppercase tracking-[0.12em] text-[10px] ${i >= 3 ? "text-right" : "text-left"} ${i === 0 ? "rounded-l-md" : ""} ${i === 6 ? "rounded-r-md" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: "#efeae0" }}>
                <td className="px-3 py-4 align-top text-zinc-500">01</td>
                <td className="px-3 py-4 align-top">
                  <p className="font-semibold" style={{ color: INK }}>Platform service fee</p>
                  <p className="mt-0.5 text-[11.5px] text-zinc-500">Marketplace, payments, customer support and technology for {st.sessions} consultations ({st.minutes.toLocaleString("en-IN")} minutes), {st.feePct}% of {money(st.gross)}</p>
                </td>
                <td className="px-3 py-4 align-top text-zinc-600">{PLATFORM.sac}</td>
                <td className="px-3 py-4 text-right align-top tabular-nums">{money(st.fee)}</td>
                <td className="px-3 py-4 text-right align-top tabular-nums">{money(intra ? st.cgst : st.igst)}<span className="block text-[10px] text-zinc-400">@ {intra ? GST_RATE / 2 : GST_RATE}%</span></td>
                <td className="px-3 py-4 text-right align-top tabular-nums">{intra ? <>{money(st.sgst)}<span className="block text-[10px] text-zinc-400">@ {GST_RATE / 2}%</span></> : ""}</td>
                <td className="px-3 py-4 text-right align-top font-semibold tabular-nums" style={{ color: INK }}>{money(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-[1fr_17rem] gap-8 px-12 py-8">
          <div className="space-y-4 text-[12px] text-zinc-600">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Amount in words</p>
              <p className="font-medium" style={{ color: INK }}>{inWords(total)}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Settlement</p>
              <p>This fee was deducted from your consultation earnings for {st.label}. No separate payment is due. Reverse charge: No.</p>
            </div>
          </div>
          <div className="rounded-xl p-5" style={{ background: "linear-gradient(160deg,#fbf7ee,#f4ecda)", border: `1px solid #e6d6ae` }}>
            <Line label="Taxable value" value={money(st.fee)} />
            {intra ? (<><Line label={`CGST @ ${GST_RATE / 2}%`} value={money(st.cgst)} /><Line label={`SGST @ ${GST_RATE / 2}%`} value={money(st.sgst)} /></>) : <Line label={`IGST @ ${GST_RATE}%`} value={money(st.igst)} />}
            <div className="mt-3 flex items-end justify-between border-t pt-3" style={{ borderColor: "#e0cfa3" }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: GOLD }}>Invoice total</span>
              <span className="font-serif text-2xl font-semibold tabular-nums" style={{ color: INK }}>{money(total)}</span>
            </div>
          </div>
        </div>

        <Signature verify={verifyCode} id={st.id} />
        <Footer page={1} />
      </Sheet>

      {/* ========================= PAGE 2 · EARNINGS STATEMENT ========================= */}
      <Sheet breakBefore>
        <Header title="Earnings Statement" subtitle={st.label} id={st.id} />
        <div className="grid grid-cols-4 border-b" style={{ borderColor: "#ece7dc" }}>
          <Meta label="Consultations" value={st.sessions.toLocaleString("en-IN")} />
          <Meta label="Minutes served" value={st.minutes.toLocaleString("en-IN")} />
          <Meta label="Payout to" value={bank} />
          <Meta label="Bank reference" value={utr} last />
        </div>

        <div className="px-12 py-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>From customer payments to your payout</p>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "#ece7dc" }}>
            <Step label="Customers paid for your consultations" value={st.gross} strong />
            <Step label={`Platform service fee (${st.feePct}%)`} value={-st.fee} note={`Tax invoice ${st.id}`} />
            <Step label={`GST on platform fee (${GST_RATE}%)`} value={-(st.cgst + st.sgst + st.igst)} note={intra ? "CGST + SGST" : "IGST"} />
            <Step label={`TDS under section 194-O @ ${st.tdsRate}%`} value={-st.tds} note={`${tds.why}. Shown in your Form 26AS`} />
            <Step label={`Tips from customers (your ${TIP_SHARE_PCT}%)`} value={st.tips} />
            <Step label={`Live gifts (your ${GIFT_SHARE_PCT}%)`} value={st.gifts} />
            <Step label="Remedy sales commission" value={st.remedy} note="Delivered orders past the return window" />
            <div className="flex items-center justify-between px-5 py-4" style={{ background: INK, color: "#f5efe1" }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Net payout</span>
              <span className="font-serif text-2xl font-semibold tabular-nums" style={{ color: "#f0cf83" }}>{money(st.net)}</span>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-zinc-500">{inWords(st.net)}</p>

          <div className="mt-8 grid grid-cols-3 gap-4 text-[11.5px]">
            <Info title="Tax deducted" body={`${money(st.tds)} deposited against PAN ${pan ?? "on file"}. Form 16A for the quarter is available in Tax & invoices.`} />
            <Info title="Disputes" body="Raise any query on this statement within 30 days from Help & guidelines with the invoice number." />
            <Info title="Records" body="Session-level details for this month are in Sessions history and the CSV statement." />
          </div>
        </div>

        <Signature verify={verifyCode} id={st.id} />
        <Footer page={2} />
      </Sheet>

      <style jsx global>{`
        .inv-root, .inv-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- building blocks ---------------- */

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center gap-2 bg-[#e9ebf1] text-sm text-zinc-600">{children}</div>;
}

function Sheet({ children, breakBefore }: { children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`relative mx-auto mb-8 flex min-h-[297mm] w-[210mm] max-w-full flex-col overflow-hidden bg-white shadow-[0_30px_80px_-40px_rgba(22,18,43,0.55)] print:mb-0 print:shadow-none ${breakBefore ? "print:break-before-page" : ""}`} style={{ color: "#3f3a52" }}>
      {/* specimen watermark until statements come from the live ledger */}
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] select-none font-serif text-[120px] font-bold tracking-[0.2em]" style={{ color: "rgba(184,137,42,0.06)" }}>SPECIMEN</span>
      {children}
    </section>
  );
}

function Header({ title, subtitle, id }: { title: string; subtitle: string; id: string }) {
  return (
    <header className="relative px-12 pb-8 pt-10" style={{ background: `linear-gradient(120deg, ${INK} 0%, #2a1f52 60%, #3a2a66 100%)`, color: "#f5efe1" }}>
      <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, #f0cf83, ${GOLD}, transparent)` }} />
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-3.5">
          <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden>
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0cf83" /><stop offset="1" stopColor={GOLD} /></linearGradient></defs>
            <circle cx="23" cy="23" r="22" fill="none" stroke="url(#g)" strokeWidth="1.5" />
            <path d="M14 19 L19 13 H27 L32 19 L23 33 Z M14 19 H32 M19 13 L23 19 L27 13 M23 19 V33" fill="none" stroke="url(#g)" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="font-serif text-[26px] font-semibold leading-none tracking-wide">Astrounkle</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.32em]" style={{ color: "#d9bf86" }}>Partner Programme</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-serif text-[22px] uppercase tracking-[0.28em]">{title}</p>
          <p className="mt-1 text-[11px] tracking-wide" style={{ color: "#cdbf9e" }}>{subtitle}</p>
          <p className="mt-3 font-mono text-[12.5px] tracking-wider" style={{ color: "#f0cf83" }}>{id}</p>
        </div>
      </div>
    </header>
  );
}

function Meta({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-6 py-4 first:pl-12 ${last ? "pr-12" : "border-r"}`} style={{ borderColor: "#ece7dc", background: "#fcfaf5" }}>
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: GOLD }}>{label}</p>
      <div className="mt-1 text-[12.5px] font-medium" style={{ color: INK }}>{value}</div>
    </div>
  );
}

function Pill({ paid }: { paid: boolean }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: paid ? "#e7f6ee" : "#fdf3dc", color: paid ? "#0f7a4a" : "#9a6a10" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: paid ? "#14a061" : "#d09a28" }} />{paid ? "Settled" : "Processing"}</span>;
}

function Party({ title, lines, accent }: { title: string; lines: string[]; accent?: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{ border: "1px solid #ece7dc", background: accent ? "#fffdf8" : "#fff" }}>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: GOLD }}>{title}</p>
      <p className="text-[14px] font-semibold" style={{ color: INK }}>{lines[0]}</p>
      {lines.slice(1).filter(Boolean).map((l) => <p key={l} className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{l}</p>)}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1 text-[12px]"><span className="text-zinc-500">{label}</span><span className="font-medium tabular-nums" style={{ color: INK }}>{value}</span></div>;
}

function Step({ label, value, note, strong }: { label: string; value: number; note?: string; strong?: boolean }) {
  const neg = value < 0;
  return (
    <div className="flex items-center justify-between border-b px-5 py-3 last:border-b-0" style={{ borderColor: "#f1ece2" }}>
      <span><span className={`text-[12.5px] ${strong ? "font-semibold" : ""}`} style={{ color: INK }}>{label}</span>{note && <span className="block text-[10.5px] text-zinc-400">{note}</span>}</span>
      <span className={`tabular-nums text-[13px] ${strong ? "font-semibold" : "font-medium"}`} style={{ color: neg ? "#b4233c" : strong ? INK : "#0f7a4a" }}>{neg ? "− " : strong ? "" : "+ "}{money(Math.abs(value))}</span>
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return <div className="rounded-lg p-4" style={{ background: "#faf8f3", border: "1px solid #efe9dc" }}><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>{title}</p><p className="leading-relaxed text-zinc-500">{body}</p></div>;
}

function Signature({ verify, id }: { verify: string; id: string }) {
  return (
    <div className="mt-auto flex items-end justify-between gap-6 px-12 pb-6">
      <div className="text-[10.5px] leading-relaxed text-zinc-400">
        <p>Verification code</p>
        <p className="font-mono text-[11.5px] tracking-wider" style={{ color: INK }}>{verify}</p>
        <p>Verify at astrounkle.com/verify/{id}</p>
      </div>
      <div className="flex items-center gap-4">
        <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden>
          <circle cx="37" cy="37" r="35" fill="none" stroke={GOLD} strokeWidth="1.2" />
          <circle cx="37" cy="37" r="29" fill="none" stroke={GOLD} strokeWidth="0.6" strokeDasharray="2 2" />
          <text x="37" y="34" textAnchor="middle" fontSize="7.5" fill={GOLD} fontFamily="Georgia, serif" letterSpacing="1">ASTROUNKLE</text>
          <text x="37" y="44" textAnchor="middle" fontSize="5.5" fill={GOLD} fontFamily="Georgia, serif" letterSpacing="1">DIGITALLY SIGNED</text>
        </svg>
        <div className="text-right text-[11px]">
          <p className="text-zinc-400">For {PLATFORM.legalName}</p>
          <p className="mt-5 font-serif text-[13px] italic" style={{ color: INK }}>Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}

function Footer({ page }: { page: number }) {
  return (
    <footer className="flex items-center justify-between px-12 py-4 text-[10px] text-zinc-400" style={{ borderTop: "1px solid #efe9dc", background: "#fcfaf5" }}>
      <span>Computer-generated document. No physical signature required. {PLATFORM.email}</span>
      <span>Page {page} of 2</span>
    </footer>
  );
}
