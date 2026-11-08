/**
 * Legal / tax helpers for the partner panel: GSTIN validation (format +
 * checksum + state code), Indian number to words, SHA-256 fingerprints for
 * e-sign records, and the monthly statement math.
 *
 * Tax rates here are DEMO defaults. The live values come from admin program
 * settings and must be confirmed with the company's tax advisor.
 */

export const GST_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
  "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman & Nicobar", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Checksum character for the first 14 characters of a GSTIN. */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GST_CHARS.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36];
}

export function validateGstin(raw: string): { ok: true; state: string; pan: string } | { ok: false; error: string } {
  const g = raw.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, error: "GSTIN must look like 08ABCDE1234F1Z5 (15 characters)" };
  if (!GST_STATES[g.slice(0, 2)]) return { ok: false, error: "The first two digits are not a valid state code" };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, error: "This GSTIN fails the checksum. Check for a typo." };
  return { ok: true, state: GST_STATES[g.slice(0, 2)], pan: g.slice(2, 12) };
}

/* ---------------- number to words (Indian system) ---------------- */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function two(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`; }
function three(n: number) { const h = Math.floor(n / 100); const r = n % 100; return [h ? `${ONES[h]} Hundred` : "", r ? two(r) : ""].filter(Boolean).join(" "); }
export function inWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const parts: string[] = [];
  const crore = Math.floor(rupees / 1e7), lakh = Math.floor((rupees % 1e7) / 1e5), thousand = Math.floor((rupees % 1e5) / 1000), rest = rupees % 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  const r = parts.length ? parts.join(" ") : "Zero";
  return `Rupees ${r}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}

/* ---------------- fingerprints ---------------- */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------- platform (issuer) details: DEMO ---------------- */
export const PLATFORM = {
  legalName: "Astrounkle Technologies Pvt. Ltd.",
  address: "Plot 12, Vedic Tower, Malviya Nagar, Jaipur, Rajasthan 302017",
  stateCode: "08",
  gstin: "08AAXCA4821K1Z" + gstinCheckChar("08AAXCA4821K1Z"),
  cin: "U72900RJ2025PTC000000",
  pan: "AAXCA4821K",
  email: "partners@astrounkle.com",
  sac: "998599",
};

/* ---------------- monthly statement math ---------------- */
export const GST_RATE = 18;
export const TDS_194O_RATE = 0.1;
export const TDS_NO_PAN_RATE = 5;

export interface TaxProfile {
  gstRegistered: boolean;
  gstin: string;
  gstLegalName: string;
  stateCode: string;
  address: string;
  resident: boolean;
  panAadhaarLinked: boolean;
  itrFiled: boolean;
  lowerCertNo: string;
  lowerCertRate: string;
  savedAt: string | null;
}

export function tdsRate(p: TaxProfile): { rate: number; why: string } {
  if (!p.panAadhaarLinked) return { rate: TDS_NO_PAN_RATE, why: "PAN not linked with Aadhaar (inoperative PAN)" };
  const lower = Number(p.lowerCertRate);
  if (p.lowerCertNo.trim() && Number.isFinite(lower) && lower >= 0 && lower < TDS_194O_RATE) return { rate: lower, why: `Lower deduction certificate ${p.lowerCertNo.trim()}` };
  return { rate: TDS_194O_RATE, why: "Section 194-O on gross consultation value" };
}

export interface MonthStatement {
  id: string;
  month: string; // "2026-10"
  label: string; // "October 2026"
  sessions: number;
  minutes: number;
  gross: number;
  feePct: number;
  fee: number;
  cgst: number;
  sgst: number;
  igst: number;
  tdsRate: number;
  tds: number;
  tips: number;
  gifts: number;
  remedy: number;
  net: number;
  status: "paid" | "processing" | "generated";
  issuedAt: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildStatements(feePct: number, profile: TaxProfile, partnerState: string, count = 6, now = 0): MonthStatement[] {
  const base = new Date(now || 0);
  const out: MonthStatement[] = [];
  const intra = partnerState === PLATFORM.stateCode;
  const tds = tdsRate(profile).rate;
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const seed = (d.getMonth() + 3) * 7;
    const sessions = 120 + ((seed * 13) % 90);
    const minutes = sessions * (9 + (seed % 5));
    const gross = r2(minutes * 25);
    const fee = r2((gross * feePct) / 100);
    const gst = r2((fee * GST_RATE) / 100);
    const tips = 300 + ((seed * 37) % 900);
    const gifts = 800 + ((seed * 53) % 2400);
    const remedy = 500 + ((seed * 71) % 1800);
    const tdsAmt = r2((gross * tds) / 100);
    const net = r2(gross - fee - gst - tdsAmt + tips + gifts + remedy);
    out.push({
      id: `INV-AU-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-0${4821 + i}`,
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      sessions, minutes, gross, feePct, fee,
      cgst: intra ? r2(gst / 2) : 0, sgst: intra ? r2(gst / 2) : 0, igst: intra ? 0 : gst,
      tdsRate: tds, tds: tdsAmt, tips, gifts, remedy, net,
      status: i === 1 ? "processing" : "paid",
      issuedAt: new Date(d.getFullYear(), d.getMonth() + 1, 3).toISOString(),
    });
  }
  return out;
}
