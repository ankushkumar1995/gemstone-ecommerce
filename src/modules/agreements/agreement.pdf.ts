import "server-only";

/**
 * Signed partner agreement → PDF (A4), generated on the server.
 *
 * Content: the EXACT version text that was signed, the key points the partner
 * confirmed, and the electronic acceptance certificate. Every page footer
 * carries the certificate number and the text hash. PDF dates are fixed to
 * the signing time, so the same record always renders the same document.
 *
 * Standard PDF fonts only (no font files to ship): text is mapped to the
 * WinAnsi character set; anything outside it (₹, emoji) is replaced safely.
 */

import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { PLATFORM } from "@/app/astrologer/_components/legal";
import type { AgreementAcceptance, PartnerAgreementView } from "./agreement.types";

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 56, top: 64, bottom: 64 };
const INK = rgb(0.086, 0.071, 0.169);
const MUTED = rgb(0.33, 0.31, 0.4);
const FAINT = rgb(0.55, 0.53, 0.6);
const GOLD = rgb(0.72, 0.54, 0.16);
const CREAM = rgb(0.98, 0.96, 0.92);

/** Map to WinAnsi (what the standard fonts can draw). */
function safe(s: string): string {
  const map: Record<string, string> = { "₹": "Rs. ", "✓": "[x]", "✔": "[x]", "•": "-", "\u00A0": " ", "\u2009": " ", "\u202F": " " };
  let out = "";
  for (const ch of s.normalize("NFKC")) {
    if (map[ch] !== undefined) { out += map[ch]; continue; }
    const c = ch.codePointAt(0) ?? 0;
    // Latin-1 plus the WinAnsi extras (curly quotes, dashes, ellipsis, euro, trademark).
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || "‘’“”–—…€™".includes(ch) || ch === "\n") out += ch;
    else out += "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of safe(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) lines.push(line);
      // A single word longer than the line (e.g. a hash): hard-break it.
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let i = rest.length;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
        lines.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });

const METHOD: Record<AgreementAcceptance["method"], string> = {
  typed_name_sms_otp: "Typed full legal name + one-time password by SMS to the registered mobile",
  typed_name_email_otp: "Typed full legal name + one-time password by email to the registered email",
};

export async function renderAgreementPdf(v: PartnerAgreementView, a: AgreementAcceptance | Omit<AgreementAcceptance, "ip" | "userAgent" | "voidedBy">): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const signed = new Date(a.signedAt);
  doc.setTitle(`${v.title} v${v.version} - ${a.signer.legalName}`);
  doc.setAuthor(PLATFORM.legalName);
  doc.setSubject(`Signed partner agreement, certificate ${a.certificateNo}`);
  doc.setKeywords([a.certificateNo, `sha256:${a.contentHash}`, `v${v.version}`]);
  doc.setProducer("Astrounkle Partner Programme");
  doc.setCreator("Astrounkle");
  doc.setCreationDate(signed);
  doc.setModificationDate(signed);

  const [regular, bold, serif] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.TimesRomanBold),
  ]);
  const width = A4.w - M.x * 2;
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const newPage = () => { page = doc.addPage([A4.w, A4.h]); y = A4.h - M.top; };
  const ensure = (h: number) => { if (y - h < M.bottom) newPage(); };
  const para = (text: string, font: PDFFont, size: number, color = MUTED, gap = 4, lead = 1.45) => {
    for (const line of wrap(text, font, size, width)) {
      ensure(size * lead);
      page.drawText(line, { x: M.x, y: y - size, size, font, color });
      y -= size * lead;
    }
    y -= gap;
  };

  /* ---- header band ---- */
  const bandH = 118;
  page.drawRectangle({ x: 0, y: A4.h - bandH, width: A4.w, height: bandH, color: INK });
  page.drawRectangle({ x: 0, y: A4.h - bandH - 3, width: A4.w, height: 3, color: GOLD });
  page.drawText("ASTROUNKLE PARTNER PROGRAMME", { x: M.x, y: A4.h - 40, size: 8.5, font: bold, color: rgb(0.85, 0.75, 0.53) });
  page.drawText(safe(v.title), { x: M.x, y: A4.h - 70, size: 24, font: serif, color: rgb(0.96, 0.94, 0.88) });
  for (const [i, line] of wrap(`Version ${v.version} · Effective ${day(v.effectiveFrom)} · Between ${PLATFORM.legalName} and ${a.signer.legalName}`, regular, 9.5, width).entries()) {
    page.drawText(line, { x: M.x, y: A4.h - 92 - i * 13, size: 9.5, font: regular, color: rgb(0.8, 0.75, 0.62) });
  }
  y = A4.h - bandH - 36;

  /* ---- clauses ---- */
  for (const c of v.clauses) {
    ensure(40);
    para(c.heading, serif, 12.5, INK, 2, 1.3);
    para(c.body, regular, 9.8, MUTED, 10);
  }

  if (v.keyPoints.length) {
    ensure(40);
    para("Confirmed by the partner before signing", serif, 12.5, INK, 2, 1.3);
    for (const k of v.keyPoints) para(`${a.keyPointsAccepted.includes(k.id) ? "[x]" : "[ ]"}  ${k.text}`, regular, 9.8, MUTED, 2);
    y -= 8;
  }

  /* ---- certificate ---- */
  const rows: [string, string][] = [
    ["Certificate no.", a.certificateNo],
    ["Signed by", `${a.typedName}  (KYC name: ${a.signer.legalName})`],
    ["Partner", `${a.signer.displayName} · ${a.signer.email}${a.signer.phoneMasked ? ` · ${a.signer.phoneMasked}` : ""}`],
    ["Signed on", fmt(a.signedAt)],
    ["Method", `${METHOD[a.method]} (${a.otp.destinationMasked})${a.otp.delivered ? "" : " - TEST MODE: OTP not delivered by a provider"}`],
    ["Device", a.device],
    ["IP address", "ip" in a && a.ip ? a.ip : a.ipMasked],
    ["Reading evidence", `${a.evidence.scrolledToEnd ? "Scrolled to the end" : "Not recorded"} · ${Math.floor(a.evidence.secondsOnPage / 60)} min ${a.evidence.secondsOnPage % 60} s on page`],
    ["Text fingerprint", `SHA-256 ${a.contentHash}`],
    ["Signature fingerprint", `SHA-256 ${a.fingerprint}`],
    ...(a.prevFingerprint ? [["Previous signature", a.prevFingerprint] as [string, string]] : []),
    ...(a.voided ? [["VOIDED", `${a.voidedAt ? fmt(a.voidedAt) : ""}${a.voidReason ? ` · ${a.voidReason}` : ""}`] as [string, string]] : []),
  ];
  const labelW = 118;
  const valW = width - labelW - 24;
  const lines = rows.map(([k, val]) => ({ k, v: wrap(val, regular, 8.8, valW) }));
  const boxH = 46 + lines.reduce((s, r) => s + r.v.length * 12.5 + 3, 0) + 34;
  if (y - boxH < M.bottom) newPage();
  const top = y;
  page.drawRectangle({ x: M.x, y: top - boxH, width, height: boxH, color: CREAM, borderColor: rgb(0.9, 0.84, 0.68), borderWidth: 1 });
  page.drawText("ELECTRONIC ACCEPTANCE CERTIFICATE", { x: M.x + 12, y: top - 22, size: 8.5, font: bold, color: GOLD });
  let cy = top - 42;
  for (const r of lines) {
    page.drawText(safe(r.k), { x: M.x + 12, y: cy, size: 8.8, font: bold, color: r.k === "VOIDED" ? rgb(0.75, 0.1, 0.2) : INK });
    r.v.forEach((ln, i) => page.drawText(ln, { x: M.x + 12 + labelW, y: cy - i * 12.5, size: 8.8, font: regular, color: INK }));
    cy -= r.v.length * 12.5 + 3;
  }
  for (const [i, ln] of wrap("Accepted electronically: a valid electronic contract under section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872. Any change to the text above changes its fingerprint.", regular, 7.8, width - 24).entries()) {
    page.drawText(ln, { x: M.x + 12, y: cy - 8 - i * 10, size: 7.8, font: regular, color: FAINT });
  }
  y = top - boxH - 12;

  /* ---- footer on every page (+ VOID watermark) ---- */
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M.x, y: 40 }, end: { x: A4.w - M.x, y: 40 }, thickness: 0.5, color: rgb(0.9, 0.88, 0.84) });
    p.drawText(safe(`${PLATFORM.legalName} · CIN ${PLATFORM.cin} · ${PLATFORM.email}`), { x: M.x, y: 28, size: 7, font: regular, color: FAINT });
    const right = safe(`${a.certificateNo} · Page ${i + 1} of ${pages.length}`);
    p.drawText(right, { x: A4.w - M.x - regular.widthOfTextAtSize(right, 7), y: 28, size: 7, font: regular, color: FAINT });
    p.drawText(`Text SHA-256 ${a.contentHash}`, { x: M.x, y: 18, size: 6, font: regular, color: FAINT });
    if (a.voided) p.drawText("VOID", { x: 150, y: 330, size: 140, font: bold, color: rgb(0.86, 0.15, 0.24), opacity: 0.1, rotate: degrees(30) });
  });

  return doc.save({ useObjectStreams: false });
}

export const pdfFileName = (version: string, certificateNo: string) => `Astrounkle-Partner-Agreement-v${version}-${certificateNo}.pdf`;
