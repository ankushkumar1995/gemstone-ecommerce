"use client";

/**
 * Report a customer from inside a live session (DEMO submit).
 * Each reason has its own safe default: abusive/sexual/threats end + block;
 * a minor is ended and auto-refunded; self-harm risk is NOT ended abruptly and
 * shows helpline guidance while the safety team is alerted.
 */

import { useState } from "react";
import { AlertTriangle, LifeBuoy } from "lucide-react";
import { AdminButton, AdminTextarea, Field, Modal, Toggle } from "@/app/admin/_components";

export const REPORT_REASONS = {
  abusive: { label: "Abusive or hateful language", end: true, block: true, note: "You keep the earning for minutes served." },
  sexual: { label: "Sexual or vulgar messages", end: true, block: true, note: "You keep the earning for minutes served." },
  threats: { label: "Threats or blackmail", end: true, block: true, note: "Our safety team reviews this first." },
  contact: { label: "Asking for my number or payment outside the app", end: false, block: false, note: "The customer gets a warning. Repeat attempts block them." },
  fraud: { label: "Fake details, chargeback threat or scam", end: true, block: true, note: "Earning for this session is held until review." },
  minor: { label: "Customer seems to be under 18", end: true, block: false, note: "The session is refunded to the customer automatically. No earning is added." },
  selfharm: { label: "Customer talks about hurting themselves", end: false, block: false, note: "Do not end the chat suddenly. Our safety team is alerted right away." },
  other: { label: "Something else", end: false, block: false, note: "Explain what happened." },
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export interface ReportInput { reason: ReportReason; details: string; end: boolean; block: boolean }

export function ReportModal({ open, onClose, customer, onSubmit }: { open: boolean; onClose: () => void; customer: string; onSubmit: (r: ReportInput) => void }) {
  const [reason, setReason] = useState<ReportReason>("abusive");
  const [details, setDetails] = useState("");
  const [end, setEnd] = useState<boolean>(REPORT_REASONS.abusive.end);
  const [block, setBlock] = useState<boolean>(REPORT_REASONS.abusive.block);
  const meta = REPORT_REASONS[reason];
  const needDetails = reason === "other" || reason === "threats" || reason === "fraud";
  const valid = !needDetails || details.trim().length >= 10;

  const pick = (r: ReportReason) => { setReason(r); setEnd(REPORT_REASONS[r].end); setBlock(REPORT_REASONS[r].block); };

  return (
    <Modal open={open} onClose={onClose} title={`Report ${customer}`} subtitle="Reports go to the Astrounkle trust & safety team with this chat attached." size="md">
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>What happened?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
              <label key={r} className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: reason === r ? "var(--a-gold)" : "var(--a-border)", color: "var(--a-fg)" }}>
                <input type="radio" name="report-reason" checked={reason === r} onChange={() => pick(r)} className="mt-1" />
                {REPORT_REASONS[r].label}
              </label>
            ))}
          </div>
        </fieldset>

        {reason === "selfharm" ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
            <p className="flex items-center gap-2 font-semibold"><LifeBuoy size={16} /> Stay with them and stay calm</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Listen. Do not predict death, danger or bad events.</li>
              <li>Gently share: Tele-MANAS helpline <b>14416</b> or <b>1-800-891-4416</b> (free, 24x7). In danger, call <b>112</b>.</li>
              <li>Our safety team is alerted as soon as you submit and may join or contact the customer.</li>
            </ul>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-xs" style={{ color: "var(--a-muted)" }}><AlertTriangle size={14} className="mt-0.5 shrink-0" />{meta.note}</p>
        )}

        <Field label={needDetails ? "Details (required)" : "Details (optional)"}>
          <AdminTextarea rows={3} value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} placeholder="What did they say or do?" />
        </Field>

        <div className="flex flex-wrap gap-6">
          <Toggle checked={end} onChange={setEnd} label="End the session now" />
          <Toggle checked={block} onChange={setBlock} label={`Block ${customer}`} />
        </div>
        {reason === "minor" && !end && <p className="text-xs text-rose-700">Sessions with minors must end. This will end the session.</p>}

        <AdminButton className="w-full" variant="danger" disabled={!valid} onClick={() => { onSubmit({ reason, details: details.trim(), end: reason === "minor" ? true : end, block }); setDetails(""); }}>Submit report</AdminButton>
      </div>
    </Modal>
  );
}
