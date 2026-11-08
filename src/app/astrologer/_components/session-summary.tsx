"use client";

/**
 * Session summary / remedy card composer (DEMO send). The customer gets it in
 * the app under "My remedies", with reminders for each remedy.
 * Rules: at least one key point or remedy; up to 5 points, 6 remedies and 3
 * products; contact details are masked; can be edited for 24 hours after
 * sending (the customer sees "updated").
 */

import { useState } from "react";
import { Eye, Plus, Send, Trash2 } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Field, useAdminToast } from "@/app/admin/_components";
import { inr, maskContacts, nowMs } from "./demo";
import { summariesStore, useStore, type Remedy, type RemedyKind, type SessionSummary } from "./demo-store";
import { MOCK_PRODUCTS } from "./mock-data";

export const REMEDY_LABEL: Record<RemedyKind, string> = { mantra: "Mantra", daan: "Daan", fast: "Fast", puja: "Puja", gemstone: "Gemstone", lifestyle: "Lifestyle", other: "Other" };
const EDIT_WINDOW_MS = 24 * 3600_000;

export function SummaryComposer({ sessionId, customer, onSent }: { sessionId: string; customer: string; onSent?: () => void }) {
  const { toast } = useAdminToast();
  const all = useStore(summariesStore);
  const existing = all[sessionId];
  const [points, setPoints] = useState<string[]>(existing?.points ?? [""]);
  const [remedies, setRemedies] = useState<Remedy[]>(existing?.remedies ?? [{ kind: "mantra", detail: "", days: 21 }]);
  const [productIds, setProductIds] = useState<string[]>(existing?.productIds ?? []);
  const [followUp, setFollowUp] = useState(existing?.followUp ?? "");
  const [preview, setPreview] = useState(false);

  const editable = !existing || nowMs() - Date.parse(existing.sentAt) < EDIT_WINDOW_MS;
  const cleanPoints = points.map((p) => maskContacts(p.trim())).filter(Boolean);
  const cleanRemedies = remedies.map((r) => ({ ...r, detail: maskContacts(r.detail.trim()) })).filter((r) => r.detail);
  const daysOk = remedies.every((r) => !r.detail.trim() || (Number.isInteger(r.days) && r.days >= 1 && r.days <= 108));
  const valid = (cleanPoints.length > 0 || cleanRemedies.length > 0) && daysOk;

  const send = () => {
    if (!valid || !editable) return;
    const s: SessionSummary = { sessionId, customer, points: cleanPoints, remedies: cleanRemedies, productIds, followUp: maskContacts(followUp.trim()), sentAt: new Date(nowMs()).toISOString() };
    summariesStore.set((m) => ({ ...m, [sessionId]: s }));
    toast(existing ? "Summary updated. The customer sees the new version." : `Summary sent to ${customer}'s app`, "success");
    onSent?.();
  };

  if (!editable && existing) return <SummaryView s={existing} />;

  return (
    <div className="space-y-4">
      {existing && <Badge tone="green">Sent {new Date(existing.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · you can edit for 24 hours</Badge>}
      <Field label="Key points" hint="What you told them, in simple words">
        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex gap-2">
              <AdminInput value={p} onChange={(e) => setPoints(points.map((x, k) => (k === i ? e.target.value.slice(0, 200) : x)))} placeholder={i === 0 ? "e.g. Strong marriage yog from Dec 2026" : "Another point"} />
              {points.length > 1 && <button type="button" aria-label="Remove point" onClick={() => setPoints(points.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button>}
            </div>
          ))}
          {points.length < 5 && <button type="button" onClick={() => setPoints([...points, ""])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add point</button>}
        </div>
      </Field>

      <Field label="Remedies" hint="Each remedy gets a daily reminder in the customer's app">
        <div className="space-y-2">
          {remedies.map((r, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr_5rem_auto] items-center gap-2">
              <AdminSelect value={r.kind} onChange={(e) => setRemedies(remedies.map((x, k) => (k === i ? { ...x, kind: e.target.value as RemedyKind } : x)))} aria-label="Remedy type">
                {(Object.keys(REMEDY_LABEL) as RemedyKind[]).map((k) => <option key={k} value={k}>{REMEDY_LABEL[k]}</option>)}
              </AdminSelect>
              <AdminInput value={r.detail} onChange={(e) => setRemedies(remedies.map((x, k) => (k === i ? { ...x, detail: e.target.value.slice(0, 150) } : x)))} placeholder="e.g. Om Shukraya Namah, 108 times, Friday morning" aria-label="Remedy detail" />
              <AdminInput type="number" min={1} max={108} value={r.days} onChange={(e) => setRemedies(remedies.map((x, k) => (k === i ? { ...x, days: Math.round(Number(e.target.value)) } : x)))} aria-label="Days" />
              <button type="button" aria-label="Remove remedy" onClick={() => setRemedies(remedies.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button>
            </div>
          ))}
          {!daysOk && <p className="text-xs text-rose-700">Days must be a whole number from 1 to 108.</p>}
          {remedies.length < 6 && <button type="button" onClick={() => setRemedies([...remedies, { kind: "daan", detail: "", days: 7 }])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add remedy</button>}
        </div>
      </Field>

      <Field label="Suggested products (optional, up to 3)" hint="Only suggest what truly fits. Never promise results.">
        <div className="flex flex-wrap gap-1.5">
          {MOCK_PRODUCTS.map((p) => {
            const on = productIds.includes(p.id);
            return <button key={p.id} type="button" aria-pressed={on} disabled={!on && productIds.length >= 3} onClick={() => setProductIds(on ? productIds.filter((x) => x !== p.id) : [...productIds, p.id])} className="rounded-full border px-2.5 py-1 text-xs disabled:opacity-40" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", color: on ? "var(--a-gold)" : "var(--a-muted)" }}>{p.name} · {inr(p.price)}</button>;
          })}
        </div>
      </Field>

      <Field label="Follow-up advice (optional)">
        <AdminTextarea rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value.slice(0, 300))} placeholder="e.g. Talk to me again after 21 days of the remedy" />
      </Field>

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="outline" onClick={() => setPreview((v) => !v)}><Eye size={15} /> {preview ? "Hide preview" : "Preview"}</AdminButton>
        <AdminButton onClick={send} disabled={!valid}><Send size={15} /> {existing ? "Update summary" : "Send to customer"}</AdminButton>
      </div>
      {!valid && <p className="text-xs" style={{ color: "var(--a-faint)" }}>Add at least one key point or remedy.</p>}
      {preview && <SummaryView s={{ sessionId, customer, points: cleanPoints, remedies: cleanRemedies, productIds, followUp: maskContacts(followUp.trim()), sentAt: new Date(nowMs()).toISOString() }} />}
    </div>
  );
}

/** How the card looks in the customer's app. */
export function SummaryView({ s }: { s: SessionSummary }) {
  const products = MOCK_PRODUCTS.filter((p) => s.productIds.includes(p.id));
  return (
    <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)", color: "var(--a-fg)" }}>
      <p className="font-semibold">Your session summary</p>
      {s.points.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5">{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {s.remedies.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>Remedies</p>
          <ul className="mt-1 space-y-1">{s.remedies.map((r, i) => <li key={i}><Badge tone="gold">{REMEDY_LABEL[r.kind]}</Badge> {r.detail} · {r.days} days</li>)}</ul>
        </div>
      )}
      {products.length > 0 && <p className="mt-3 text-xs">Suggested: {products.map((p) => p.name).join(", ")}</p>}
      {s.followUp && <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>{s.followUp}</p>}
    </div>
  );
}
