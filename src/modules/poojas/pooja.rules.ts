/**
 * Poojas — pure rules (no I/O). Shared by the service, the admin UI and tests.
 *   • IST date helpers
 *   • slot generation + cutoff
 *   • refund amount from the policy
 *   • booking status transitions
 *   • "ready to publish" checks
 *   • a blank pooja with sensible defaults
 */

import type { Pooja, PoojaBookingStatus, PoojaPolicy, SlotView } from "./pooja.types";

const IST_MS = 330 * 60_000;

/** Today's date in IST, "YYYY-MM-DD". */
export function istToday(now: number): string {
  return new Date(now + IST_MS).toISOString().slice(0, 10);
}
/** Add days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** 0 = Sunday … 6 = Saturday for a "YYYY-MM-DD" date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
/** Epoch ms of an IST date + time. "any" time = start of the day. */
export function slotInstant(date: string, time: string): number {
  return Date.parse(`${date}T${time === "any" ? "00:00" : time}:00+05:30`);
}
export const slotKey = (date: string, time: string) => `${date}T${time}`;
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Every slot of a pooja between `from` and `from + days` (IST dates), with the
 * capacity and the cutoff applied. `usage` maps slot key → bookings already made.
 */
export function buildSlots(p: Pick<Pooja, "schedule">, now: number, usage: Record<string, number>, opts: { from?: string; days?: number } = {}): SlotView[] {
  const s = p.schedule;
  const today = istToday(now);
  const from = opts.from && opts.from > today ? opts.from : today;
  const lastDay = addDays(today, s.advanceDays);
  const until = opts.days !== undefined ? addDays(from, opts.days) : lastDay;
  const end = until < lastDay ? until : lastDay;
  const blackout = new Set(s.blackoutDates);
  const out: SlotView[] = [];
  const push = (date: string, time: string, label: string, cap: number, priceDelta: number) => {
    const key = slotKey(date, time);
    const booked = usage[key] ?? 0;
    const closed = slotInstant(date, time) - s.cutoffHours * 3_600_000 <= now;
    out.push({ key, date, time, label, capacity: cap, booked, left: Math.max(0, cap - booked), priceDelta, closed });
  };

  if (s.mode === "fixed_dates") {
    for (const f of [...s.fixedDates].sort((a, b) => slotKey(a.date, a.time).localeCompare(slotKey(b.date, b.time)))) {
      if (f.date < from || f.date > end || blackout.has(f.date)) continue;
      push(f.date, f.time, f.label, f.capacity ?? s.slotCapacity, f.priceDelta);
    }
    return out;
  }
  for (let d = from; d <= end; d = addDays(d, 1)) {
    if (blackout.has(d)) continue;
    if (s.mode === "on_request") { push(d, "any", "", s.slotCapacity, 0); continue; }
    if (!s.weekdays.includes(weekdayOf(d))) continue;
    for (const t of [...s.times].sort()) push(d, t, "", s.slotCapacity, 0);
  }
  return out;
}

/** Find one slot by date + time, ignoring the advance window (admins may book far ahead). */
export function findSlot(p: Pick<Pooja, "schedule">, date: string, time: string, now: number, usage: Record<string, number>): SlotView | null {
  const s = p.schedule;
  if (s.blackoutDates.includes(date)) return null;
  const key = slotKey(date, time);
  const booked = usage[key] ?? 0;
  const closed = slotInstant(date, time) - s.cutoffHours * 3_600_000 <= now;
  const make = (cap: number, label: string, priceDelta: number): SlotView => ({ key, date, time, label, capacity: cap, booked, left: Math.max(0, cap - booked), priceDelta, closed });
  if (s.mode === "fixed_dates") {
    const f = s.fixedDates.find((x) => x.date === date && x.time === time);
    return f ? make(f.capacity ?? s.slotCapacity, f.label, f.priceDelta) : null;
  }
  if (s.mode === "on_request") return time === "any" ? make(s.slotCapacity, "", 0) : null;
  return s.weekdays.includes(weekdayOf(date)) && s.times.includes(time) ? make(s.slotCapacity, "", 0) : null;
}

/** Refund the policy allows if cancelled `now`, for an amount still refundable. */
export function policyRefund(policy: PoojaPolicy, slotAt: number, now: number, refundable: number): { pct: number; amount: number } {
  const hours = (slotAt - now) / 3_600_000;
  const tier = [...policy.refundTiers].sort((a, b) => b.hoursBefore - a.hoursBefore).find((t) => hours >= t.hoursBefore);
  const pct = tier ? tier.refundPct : 0;
  return { pct, amount: Math.floor((refundable * pct) / 100) };
}

/** Allowed booking status moves. Refunds and prasad have their own rules. */
export const TRANSITIONS: Record<PoojaBookingStatus, PoojaBookingStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  assigned: ["in_progress", "confirmed", "cancelled"],
  in_progress: ["performed", "assigned"],
  performed: ["completed"],
  completed: [],
  cancelled: [],
};
/** Statuses where the slot, sankalp and schedule can still change. */
export const EDITABLE: PoojaBookingStatus[] = ["pending_payment", "confirmed", "assigned"];
/** Statuses that hold a seat in the slot. */
export const HOLDS_SEAT: PoojaBookingStatus[] = ["pending_payment", "confirmed", "assigned", "in_progress", "performed", "completed"];

/** What is missing before a pooja can go live. Drafts may be incomplete. */
export function publishIssues(p: Pooja): string[] {
  const issues: string[] = [];
  if (!p.coverImage) issues.push("Add a cover image");
  if (p.shortDescription.trim().length < 20) issues.push("Write a short description (20+ characters)");
  if (!p.packages.some((x) => x.active)) issues.push("Add at least one active package");
  if (p.packages.some((x) => x.active && x.price < 1)) issues.push("Every active package needs a price of at least ₹1");
  const s = p.schedule;
  if (s.mode === "weekly" && (!s.weekdays.length || !s.times.length)) issues.push("Pick weekdays and at least one time");
  if (s.mode === "fixed_dates" && !s.fixedDates.length) issues.push("Add at least one date");
  if (!p.location.place.trim() && p.location.mode !== "our_pandits") issues.push("Add the temple or place name");
  if (p.type === "havan") {
    if (p.havan.mode === "ekal" && p.schedule.slotCapacity !== 1) issues.push("Ekal havan needs 1 booking per date");
    if (p.havan.samagri.filter((s) => s.trim()).length === 0) issues.push("List the havan samagri");
  }
  return issues;
}

export const blankSchedule = (): Pooja["schedule"] => ({ mode: "weekly", weekdays: [1], times: ["07:00"], fixedDates: [], slotCapacity: 50, cutoffHours: 24, advanceDays: 60, blackoutDates: [] });
export const blankPolicy = (): PoojaPolicy => ({ freeRescheduleHours: 48, maxReschedules: 2, refundTiers: [{ hoursBefore: 72, refundPct: 100 }, { hoursBefore: 24, refundPct: 50 }], proofSlaHours: 48, prasadDispatchDays: 3 });
export const blankSankalp = (): Pooja["sankalp"] => ({ requireGotra: true, requireDob: false, requireBirthPlace: false, requireWish: true, askRelation: true, wishMaxLength: 300, defaultGotra: "Kashyap", instructions: "" });
