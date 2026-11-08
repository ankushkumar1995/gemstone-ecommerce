"use client";

/**
 * Schedule (DEMO). Weekly working hours, leaves, booking rules and upcoming
 * appointments. Slot rules are validated the same way the backend will:
 * start before end, no overlaps within a day, at most 4 slots per day.
 */

import { useState } from "react";
import { CalendarDays, CalendarOff, Clock, MessageCircle, Phone, Plus, Trash2, Video, X } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, Field, Modal, PageHeader, StatsSkeleton, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DemoBanner, fmtDateTime } from "../../_components/demo";
import { MOCK_APPOINTMENTS, MOCK_LEAVES, MOCK_WEEK } from "../../_components/mock-data";

type Week = typeof MOCK_WEEK;
const ICON = { chat: MessageCircle, call: Phone, video: Video } as const;
const MAX_SLOTS = 4;

function validate(week: Week): string | null {
  for (const d of week) {
    if (!d.on) continue;
    if (d.slots.length === 0) return `${d.day}: add at least one slot or turn the day off`;
    const sorted = [...d.slots].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].from >= sorted[i].to) return `${d.day}: a slot must end after it starts`;
      if (i > 0 && sorted[i].from < sorted[i - 1].to) return `${d.day}: slots overlap`;
    }
  }
  return null;
}

const hoursOf = (week: Week) =>
  week.reduce((sum, d) => sum + (d.on ? d.slots.reduce((s, x) => { const [fh, fm] = x.from.split(":").map(Number); const [th, tm] = x.to.split(":").map(Number); return s + Math.max(0, th * 60 + tm - (fh * 60 + fm)); }, 0) : 0), 0) / 60;

export default function SchedulePage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [week, setWeek] = useState<Week>(() => MOCK_WEEK.map((d) => ({ ...d, slots: d.slots.map((s) => ({ ...s })) })));
  const [rules, setRules] = useState({ acceptBookings: true, bufferMin: 10, maxPerDay: 8, noticeHours: 2 });
  const [leaves, setLeaves] = useState(MOCK_LEAVES);
  const [leaveForm, setLeaveForm] = useState({ from: "", to: "", reason: "" });
  const [appointments, setAppointments] = useState(MOCK_APPOINTMENTS);
  const [cancelAsk, setCancelAsk] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  if (loading || !me) return <StatsSkeleton count={3} />;
  const err = validate(week);

  const setDay = (i: number, patch: Partial<Week[number]>) => setWeek((w) => w.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const setSlot = (i: number, j: number, key: "from" | "to", v: string) => setWeek((w) => w.map((d, k) => (k === i ? { ...d, slots: d.slots.map((s, m) => (m === j ? { ...s, [key]: v } : s)) } : d)));

  const save = () => {
    if (err) return toast(err, "error");
    toast("Schedule saved. Customers see your next available time.", "success");
  };
  const addLeave = () => {
    if (!leaveForm.from || !leaveForm.to || leaveForm.to < leaveForm.from) return toast("Pick a valid date range", "error");
    setLeaves((l) => [...l, { id: `lv${l.length + 2}`, from: new Date(leaveForm.from).toISOString(), to: new Date(leaveForm.to).toISOString(), reason: leaveForm.reason.trim() || "Leave" }]);
    setLeaveForm({ from: "", to: "", reason: "" });
    toast("Leave added. Bookings are blocked for those days.", "success");
  };
  const cancel = () => {
    if (!cancelAsk || cancelReason.trim().length < 5) return;
    setAppointments((a) => a.filter((x) => x.id !== cancelAsk));
    setCancelAsk(null);
    setCancelReason("");
    toast("Appointment cancelled. The customer gets a full refund and a notification.", "info");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" subtitle={`${hoursOf(week).toFixed(1)} hours a week · Times are in IST`} action={<AdminButton onClick={save} disabled={!!err}>Save schedule</AdminButton>} />
      <DemoBanner />
      {err && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700" role="alert">{err}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="p-5">
          <p className="mb-4 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Clock size={16} /> Weekly hours</p>
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {week.map((d, i) => (
              <li key={d.day} className="flex flex-wrap items-start gap-4 py-3">
                <div className="w-32 pt-1.5"><Toggle checked={d.on} onChange={(v) => setDay(i, { on: v, slots: v && d.slots.length === 0 ? [{ from: "10:00", to: "14:00" }] : d.slots })} label={d.day} /></div>
                <div className="flex-1 space-y-2">
                  {!d.on && <p className="pt-1.5 text-sm" style={{ color: "var(--a-faint)" }}>Unavailable</p>}
                  {d.on && d.slots.map((s, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <AdminInput type="time" value={s.from} onChange={(e) => setSlot(i, j, "from", e.target.value)} aria-label={`${d.day} slot ${j + 1} start`} className="w-32" />
                      <span style={{ color: "var(--a-muted)" }}>to</span>
                      <AdminInput type="time" value={s.to} onChange={(e) => setSlot(i, j, "to", e.target.value)} aria-label={`${d.day} slot ${j + 1} end`} className="w-32" />
                      <button type="button" aria-label="Remove slot" onClick={() => setDay(i, { slots: d.slots.filter((_, m) => m !== j) })} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {d.on && d.slots.length < MAX_SLOTS && (
                    <button type="button" onClick={() => setDay(i, { slots: [...d.slots, { from: "18:00", to: "20:00" }] })} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add slot</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Booking rules</p>
            <Toggle checked={rules.acceptBookings} onChange={(v) => setRules({ ...rules, acceptBookings: v })} label="Accept scheduled bookings" />
            <Field label="Gap between bookings">
              <AdminSelect value={rules.bufferMin} onChange={(e) => setRules({ ...rules, bufferMin: Number(e.target.value) })}>{[0, 5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} min</option>)}</AdminSelect>
            </Field>
            <Field label="Max bookings per day">
              <AdminSelect value={rules.maxPerDay} onChange={(e) => setRules({ ...rules, maxPerDay: Number(e.target.value) })}>{[2, 4, 6, 8, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}</AdminSelect>
            </Field>
            <Field label="Minimum notice">
              <AdminSelect value={rules.noticeHours} onChange={(e) => setRules({ ...rules, noticeHours: Number(e.target.value) })}>{[1, 2, 4, 12, 24].map((n) => <option key={n} value={n}>{n} hour{n > 1 ? "s" : ""}</option>)}</AdminSelect>
            </Field>
          </Card>

          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarOff size={16} /> Leaves</p>
            {leaves.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No leaves planned.</p>}
            {leaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                <span>{new Date(l.from).toLocaleDateString("en-IN")} to {new Date(l.to).toLocaleDateString("en-IN")} · {l.reason}</span>
                <button type="button" aria-label="Remove leave" onClick={() => setLeaves((x) => x.filter((y) => y.id !== l.id))} className="text-rose-600"><X size={15} /></button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <AdminInput type="date" value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value })} aria-label="Leave from" />
              <AdminInput type="date" value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} aria-label="Leave to" />
            </div>
            <AdminInput value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value.slice(0, 80) })} placeholder="Reason (only admin sees it)" />
            <AdminButton variant="outline" onClick={addLeave}><Plus size={15} /> Add leave</AdminButton>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarDays size={16} /> Upcoming appointments</p>
        {appointments.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>No upcoming appointments.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {appointments.map((a) => {
              const I = ICON[a.channel];
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <I size={18} style={{ color: "var(--a-gold)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{a.customer} · {a.topic}</p>
                    <p className="text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(a.at)} · {a.minutes} min · {CHANNEL_LABEL[a.channel]}</p>
                  </div>
                  <Badge tone="blue">Prepaid</Badge>
                  <AdminButton variant="ghost" onClick={() => setCancelAsk(a.id)}>Cancel</AdminButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={!!cancelAsk} onClose={() => setCancelAsk(null)} title="Cancel this appointment?" subtitle="The customer is refunded in full. Frequent cancellations lower your ranking." size="sm">
        <div className="space-y-4">
          <Field label="Reason (sent to the customer)"><AdminTextarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value.slice(0, 300))} /></Field>
          <AdminButton className="w-full" variant="danger" disabled={cancelReason.trim().length < 5} onClick={cancel}>Cancel appointment</AdminButton>
        </div>
      </Modal>
    </div>
  );
}
