"use client";

/**
 * Schedule: weekly working hours (IST) and planned leaves, saved to the
 * partner's profile. Customers see the hours and upcoming leave dates on the
 * public profile (never the reason). The server re-checks every rule:
 * start before end, no overlaps, max 4 slots a day, leaves not overlapping.
 *
 * Scheduled (pre-booked) appointments come with the consultation engine.
 */

import { useState } from "react";
import { CalendarClock, CalendarOff, Clock, Plus, Trash2, X } from "lucide-react";
import { AdminButton, AdminInput, Card, PageHeader, StatsSkeleton, Toggle, useAdminToast } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";
import type { AstrologerLeave, AvailabilitySlot } from "@/modules/astrologers/astrologer.types";
import { usePartner } from "../../_components/partner-context";

const MAX_SLOTS = 4;
/** Monday first, mapped to the stored day index (0 = Sunday). */
const DAYS: { name: string; idx: AvailabilitySlot["day"] }[] = [
  { name: "Monday", idx: 1 }, { name: "Tuesday", idx: 2 }, { name: "Wednesday", idx: 3 }, { name: "Thursday", idx: 4 },
  { name: "Friday", idx: 5 }, { name: "Saturday", idx: 6 }, { name: "Sunday", idx: 0 },
];

type Day = { name: string; idx: AvailabilitySlot["day"]; on: boolean; slots: { start: string; end: string }[] };

const toWeek = (slots: AvailabilitySlot[]): Day[] =>
  DAYS.map((d) => {
    const s = slots.filter((x) => x.day === d.idx).sort((a, b) => a.start.localeCompare(b.start)).map((x) => ({ start: x.start, end: x.end }));
    return { ...d, on: s.length > 0, slots: s };
  });
const fromWeek = (week: Day[]): AvailabilitySlot[] => week.flatMap((d) => (d.on ? d.slots.map((s) => ({ day: d.idx, start: s.start, end: s.end })) : []));

function validate(week: Day[]): string | null {
  for (const d of week) {
    if (!d.on) continue;
    if (d.slots.length === 0) return `${d.name}: add a slot or turn the day off`;
    const sorted = [...d.slots].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      if (!sorted[i].start || !sorted[i].end) return `${d.name}: fill both times`;
      if (sorted[i].start >= sorted[i].end) return `${d.name}: a slot must end after it starts`;
      if (i > 0 && sorted[i].start < sorted[i - 1].end) return `${d.name}: slots overlap`;
    }
  }
  return null;
}

const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hoursOf = (week: Day[]) => week.reduce((sum, d) => sum + (d.on ? d.slots.reduce((s, x) => s + Math.max(0, minutes(x.end) - minutes(x.start)), 0) : 0), 0) / 60;
const fmtDate = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export default function SchedulePage() {
  const { me, loading, setMe } = usePartner();
  const { toast } = useAdminToast();
  const [week, setWeek] = useState<Day[] | null>(null);
  const [leaves, setLeaves] = useState<AstrologerLeave[] | null>(null);
  const [leaveForm, setLeaveForm] = useState({ from: "", to: "", reason: "" });
  const [dirty, setDirty] = useState(false);

  if (loading || !me) return <StatsSkeleton count={3} />;
  // Start from the saved profile the first time.
  const w = week ?? toWeek(me.availability);
  const lv = leaves ?? (me.leaves ?? []);
  const err = validate(w);
  const today = todayIst();
  const onLeaveNow = lv.find((l) => l.from <= today && l.to >= today);

  const edit = (next: Day[]) => { setWeek(next); setDirty(true); };
  const setDay = (i: number, patch: Partial<Day>) => edit(w.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const setSlot = (i: number, j: number, key: "start" | "end", v: string) => edit(w.map((d, k) => (k === i ? { ...d, slots: d.slots.map((s, m) => (m === j ? { ...s, [key]: v } : s)) } : d)));
  const copyToAll = (i: number) => edit(w.map((d) => ({ ...d, on: w[i].on, slots: w[i].slots.map((s) => ({ ...s })) })));

  const save = async (nextLeaves = lv) => {
    if (err) { toast(err, "error"); return; }
    const r = await partnerApi.updateProfile({ availability: fromWeek(w), leaves: nextLeaves });
    if (!r.ok) { toast(r.message, "error"); return; }
    setMe(r.data);
    setWeek(toWeek(r.data.availability));
    setLeaves(r.data.leaves ?? []);
    setDirty(false);
    toast("Schedule saved. Customers see your hours on your profile.", "success");
  };

  const addLeave = async () => {
    if (!leaveForm.from || !leaveForm.to) { toast("Pick both dates", "error"); return; }
    if (leaveForm.to < leaveForm.from) { toast("The leave must end on or after the start date", "error"); return; }
    if (leaveForm.to < today) { toast("Pick dates from today onwards", "error"); return; }
    const next = [...lv, { id: "", from: leaveForm.from, to: leaveForm.to, reason: leaveForm.reason.trim() || undefined }];
    await save(next);
    setLeaveForm({ from: "", to: "", reason: "" });
  };
  const removeLeave = async (id: string) => { await save(lv.filter((x) => x.id !== id)); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        subtitle={`${hoursOf(w).toFixed(1)} hours a week · Times are in IST`}
        action={<AdminButton onClick={() => save()} disabled={!!err || !dirty}>{dirty ? "Save schedule" : "Saved"}</AdminButton>}
      />
      {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700" role="alert">{err}</p>}
      {onLeaveNow && (
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-gold-soft)", color: "var(--a-fg)" }} role="status">
          You are on leave until {fmtDate(onLeaveNow.to)}. Customers see this on your profile.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="p-5">
          <p className="mb-1 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Clock size={16} /> Weekly hours</p>
          <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>When customers can usually find you online. Up to {MAX_SLOTS} slots a day.</p>
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {w.map((d, i) => (
              <li key={d.name} className="flex flex-wrap items-start gap-4 py-3">
                <div className="w-32 pt-1.5"><Toggle checked={d.on} onChange={(v) => setDay(i, { on: v, slots: v && d.slots.length === 0 ? [{ start: "10:00", end: "14:00" }] : d.slots })} label={d.name} /></div>
                <div className="flex-1 space-y-2">
                  {!d.on && <p className="pt-1.5 text-sm" style={{ color: "var(--a-faint)" }}>Unavailable</p>}
                  {d.on && d.slots.map((s, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <AdminInput type="time" value={s.start} onChange={(e) => setSlot(i, j, "start", e.target.value)} aria-label={`${d.name} slot ${j + 1} start`} className="w-32" />
                      <span style={{ color: "var(--a-muted)" }}>to</span>
                      <AdminInput type="time" value={s.end} onChange={(e) => setSlot(i, j, "end", e.target.value)} aria-label={`${d.name} slot ${j + 1} end`} className="w-32" />
                      <button type="button" aria-label="Remove slot" onClick={() => setDay(i, { slots: d.slots.filter((_, m) => m !== j) })} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {d.on && (
                    <div className="flex gap-4">
                      {d.slots.length < MAX_SLOTS && (
                        <button type="button" onClick={() => setDay(i, { slots: [...d.slots, { start: "18:00", end: "20:00" }] })} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add slot</button>
                      )}
                      <button type="button" onClick={() => copyToAll(i)} className="text-xs font-medium" style={{ color: "var(--a-muted)" }}>Copy to all days</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarOff size={16} /> Leaves</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Customers see the dates. The reason is only for our team.</p>
            {lv.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No leaves planned.</p>}
            {lv.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                <span>{fmtDate(l.from)}{l.to !== l.from ? ` to ${fmtDate(l.to)}` : ""}{l.reason ? ` · ${l.reason}` : ""}</span>
                <AdminButton variant="ghost" aria-label="Remove leave" onClick={() => removeLeave(l.id)} className="px-2 py-1 text-rose-600"><X size={15} /></AdminButton>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <AdminInput type="date" min={today} value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value, to: leaveForm.to || e.target.value })} aria-label="Leave from" />
              <AdminInput type="date" min={leaveForm.from || today} value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} aria-label="Leave to" />
            </div>
            <AdminInput value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value.slice(0, 120) })} placeholder="Reason (optional, only our team sees it)" />
            <AdminButton variant="outline" onClick={addLeave} disabled={!!err}><Plus size={15} /> Add leave</AdminButton>
            {err && <p className="text-xs text-rose-700">Fix your weekly hours first.</p>}
          </Card>

          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarClock size={16} /> Scheduled bookings</p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Pre-booked appointments are coming soon, together with live consultations.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
