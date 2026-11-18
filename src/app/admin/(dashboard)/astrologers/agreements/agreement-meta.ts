/** Small shared helpers for the admin partner-agreement pages. */

import type { AgreementStatus } from "@/modules/agreements/agreement.types";

export const AGR_STATUS: Record<AgreementStatus, { label: string; tone: "gold" | "green" | "muted" }> = {
  draft: { label: "Draft", tone: "gold" },
  published: { label: "Current", tone: "green" },
  retired: { label: "Retired", tone: "muted" },
};

export const fmtIst = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

export const fmtDay = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "–";

/** Wall clock (keeps impure calls out of component bodies). */
export const nowMs = () => Date.now();

/** ISO → value for <input type="datetime-local"> (browser local time). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value → ISO (browser local time). */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : "");

/** Download rows as a CSV file (Excel friendly, UTF-8 BOM). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
