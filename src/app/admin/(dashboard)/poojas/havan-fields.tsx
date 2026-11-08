"use client";

/**
 * Havan / yagya parts of the pooja editor:
 *   • TypeChooser   Pooja vs Havan (Basics section)
 *   • HavanFields   ekal / samuhik, days, kund, live link, samagri, deliverables
 *   • TierFields    jaap / ahuti / pandits on each package (havan only)
 */

import { Flame, Plus, Sparkles, Trash2, Users, User } from "lucide-react";
import type { HavanConfig, PoojaPackage, RitualType } from "@/modules/poojas/pooja.types";
import { AdminInput, Field } from "../../_components";

export const HAVAN_SAMAGRI_DEFAULT = ["Desi ghee", "Mango wood samidha", "Havan samagri", "Til (sesame)", "Jau (barley)", "Guggal", "Kapoor"];
export const HAVAN_DELIVERABLES_DEFAULT = ["Havan bhasma", "Raksha sutra", "Full havan video"];

export function TypeChooser({ value, onChange, locked }: { value: RitualType; onChange: (t: RitualType) => void; locked?: boolean }) {
  const opts: { v: RitualType; t: string; d: string; icon: typeof Flame }[] = [
    { v: "pooja", t: "Pooja", d: "Archana, abhishek, path", icon: Sparkles },
    { v: "havan", t: "Havan / Yagya", d: "Agni ritual, anushthan, jaap", icon: Flame },
  ];
  return (
    <Field label="Type" hint={locked ? "Type cannot change once there are bookings" : "Havan shows on /havan, pooja on /pooja"}>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type">
        {opts.map((o) => {
          const on = value === o.v;
          return (
            <button key={o.v} type="button" role="radio" aria-checked={on} disabled={locked && !on} onClick={() => onChange(o.v)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "var(--a-gold-soft)" : undefined }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: on ? "linear-gradient(135deg, #e6b43a, #c9942a)" : "linear-gradient(135deg, #c9c3d6, #a9a1bb)" }}><o.icon size={16} /></span>
              <span><span className="block text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{o.t}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{o.d}</span></span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function ListField({ label, hint, items, onChange, placeholder, max }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number }) {
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={i} className="flex gap-2">
            <AdminInput value={x} maxLength={120} onChange={(e) => onChange(items.map((y, k) => (k === i ? e.target.value : y)))} placeholder={placeholder} />
            <button type="button" aria-label={`Remove ${label} ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button>
          </div>
        ))}
        {items.length < max && <button type="button" onClick={() => onChange([...items, ""])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add</button>}
      </div>
    </Field>
  );
}

const int = (v: string, min: number) => (v === "" ? NaN : Math.max(min, Math.round(Number(v))));

export function HavanFields({ havan, onChange, slotCapacity, onSlotCapacity }: {
  havan: HavanConfig; onChange: (h: HavanConfig) => void; slotCapacity: number; onSlotCapacity: (n: number) => void;
}) {
  const set = (patch: Partial<HavanConfig>) => onChange({ ...havan, ...patch });
  const modes = [
    { v: "samuhik" as const, t: "Samuhik (group)", d: "Many devotees share one havan. Lower price, set seats per date.", icon: Users },
    { v: "ekal" as const, t: "Ekal (exclusive)", d: "Performed only for one yajman. One booking per date.", icon: User },
  ];
  return (
    <div className="space-y-4">
      <Field label="How it is performed">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Havan mode">
          {modes.map((m) => {
            const on = havan.mode === m.v;
            return (
              <button key={m.v} type="button" role="radio" aria-checked={on}
                onClick={() => { set({ mode: m.v }); if (m.v === "ekal") onSlotCapacity(1); else if (slotCapacity <= 1) onSlotCapacity(50); }}
                className="flex items-start gap-3 rounded-lg border p-3 text-left" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "var(--a-gold-soft)" : undefined }}>
                <m.icon size={18} className="mt-0.5 shrink-0" style={{ color: on ? "var(--a-gold)" : "var(--a-muted)" }} />
                <span><span className="block text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{m.t}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{m.d}</span></span>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duration (days)" hint={havan.durationDays > 1 ? "Anushthan: daily updates for the devotee" : "1 = single-day havan"}>
          <AdminInput type="number" min={1} max={41} value={Number.isNaN(havan.durationDays) ? "" : havan.durationDays} onChange={(e) => set({ durationDays: int(e.target.value, 1) })} />
        </Field>
        <Field label="Havan kund">
          <AdminInput type="number" min={1} max={108} value={Number.isNaN(havan.kundCount) ? "" : havan.kundCount} onChange={(e) => set({ kundCount: int(e.target.value, 1) })} />
        </Field>
        <Field label="Live link (optional)" hint="YouTube live / meeting link">
          <AdminInput value={havan.liveUrl} onChange={(e) => set({ liveUrl: e.target.value.trim() })} placeholder="https://youtube.com/live/..." />
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ListField label="Samagri offered" hint="Shown on the havan page" items={havan.samagri} onChange={(v) => set({ samagri: v })} placeholder="Desi ghee" max={30} />
        <ListField label="Devotee receives" hint="Bhasma, raksha sutra, yantra…" items={havan.deliverables} onChange={(v) => set({ deliverables: v })} placeholder="Havan bhasma" max={20} />
      </div>
      {havan.samagri.length === 0 && (
        <button type="button" onClick={() => set({ samagri: HAVAN_SAMAGRI_DEFAULT, deliverables: havan.deliverables.length ? havan.deliverables : HAVAN_DELIVERABLES_DEFAULT })} className="text-xs font-semibold" style={{ color: "var(--a-gold)" }}>
          Fill the usual samagri list
        </button>
      )}
    </div>
  );
}

/** Jaap / ahuti / pandits for one package (havan tiers). */
export function TierFields({ pkg, onChange }: { pkg: PoojaPackage; onChange: (patch: Partial<PoojaPackage>) => void }) {
  const num = (v: string) => (v === "" ? null : Math.max(1, Math.round(Number(v))));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Mantra jaap" hint="e.g. 11000, 51000, 125000">
        <AdminInput type="number" min={1} value={pkg.jaapCount ?? ""} onChange={(e) => onChange({ jaapCount: num(e.target.value) })} placeholder="Not shown" />
      </Field>
      <Field label="Ahuti">
        <AdminInput type="number" min={1} value={pkg.ahutiCount ?? ""} onChange={(e) => onChange({ ahutiCount: num(e.target.value) })} placeholder="Not shown" />
      </Field>
      <Field label="Pandits for this tier">
        <AdminInput type="number" min={1} max={108} value={pkg.panditCount ?? ""} onChange={(e) => onChange({ panditCount: num(e.target.value) })} placeholder="Default" />
      </Field>
    </div>
  );
}
