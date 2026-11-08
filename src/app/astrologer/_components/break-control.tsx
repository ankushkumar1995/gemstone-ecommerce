"use client";

/**
 * Break mode (DEMO). A short pause that is different from going offline:
 *   • customers see "On a break, back at 4:40 pm" instead of "Offline"
 *   • no new requests ring; the waitlist can stay open (setting)
 *   • missed-request streak is not affected
 * Rules: only while online and not in a live session; 5 to 30 minutes per
 * break; at most BREAK_DAILY_COUNT breaks and BREAK_DAILY_MIN minutes a day;
 * ends automatically, can be ended early or extended (within the limits).
 * Going offline ends the break.
 */

import { useEffect, useRef, useState } from "react";
import { Coffee, Play, Plus } from "lucide-react";
import { AdminButton, Modal, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { DEMO_SESSION_KEY, nowMs } from "./demo";
import { BREAK_DAILY_COUNT, BREAK_DAILY_MIN, breakStore, liveStore, todayKey, useStore, type BreakState } from "./demo-store";

const OPTIONS = [5, 10, 15, 30];

/** Normalise the stored state for today (daily counters reset at midnight). */
function forToday(s: BreakState): BreakState {
  const day = todayKey();
  return s.day === day ? s : { ...s, day, usedMin: 0, count: 0 };
}

export function isOnBreak(s: BreakState, now: number) {
  return s.until !== null && s.until > now;
}

const clockOf = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function BreakButton() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const raw = useStore(breakStore);
  const [open, setOpen] = useState(false);
  const [mins, setMins] = useState(10);
  const s = forToday(raw);

  if (!me || me.status !== "approved" || !me.presence.online || raw.until !== null) return null;
  const leftMin = BREAK_DAILY_MIN - s.usedMin;
  const leftCount = BREAK_DAILY_COUNT - s.count;

  const start = () => {
    if (sessionStorage.getItem(DEMO_SESSION_KEY)) return toast("Finish your live session before taking a break.", "error");
    if (liveStore.get()) return toast("You are live. Use “Be right back” on the live instead.", "error");
    if (leftCount <= 0) return toast(`You have used all ${BREAK_DAILY_COUNT} breaks for today. Go offline instead.`, "error");
    if (mins > leftMin) return toast(`Only ${leftMin} break minutes left today.`, "error");
    const t = nowMs();
    breakStore.set({ ...s, until: t + mins * 60000, startedAt: t, usedMin: s.usedMin + mins, count: s.count + 1 });
    setOpen(false);
    toast(`On a break until ${clockOf(t + mins * 60000)}. Customers see when you are back.`, "info");
  };

  return (
    <>
      <AdminButton variant="ghost" onClick={() => setOpen(true)} aria-label="Take a break"><Coffee size={16} /><span className="hidden md:inline">Break</span></AdminButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Take a short break" subtitle="Requests pause and customers see when you are back. Your missed streak is not affected." size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Break length">
            {OPTIONS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mins === m} disabled={m > leftMin} onClick={() => setMins(m)}
                className="rounded-lg border py-2 text-sm font-medium disabled:opacity-40"
                style={{ borderColor: mins === m ? "var(--a-gold)" : "var(--a-border)", color: mins === m ? "var(--a-gold)" : "var(--a-fg)", background: mins === m ? "var(--a-gold-soft)" : undefined }}>
                {m} min
              </button>
            ))}
          </div>
          <Toggle checked={s.keepQueue} onChange={(v) => breakStore.set({ ...s, keepQueue: v })} label="Let customers join my waitlist during the break" />
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Today: {s.count}/{BREAK_DAILY_COUNT} breaks used, {Math.max(0, leftMin)} of {BREAK_DAILY_MIN} minutes left.</p>
          <AdminButton className="w-full" onClick={start} disabled={leftCount <= 0 || leftMin < OPTIONS[0]}>Start {mins} min break</AdminButton>
        </div>
      </Modal>
    </>
  );
}

/** Full-width banner while on break, with countdown, extend and end. */
export function BreakBanner() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const raw = useStore(breakStore);
  const [now, setNow] = useState(0);
  const endedRef = useRef<number | null>(null);
  const online = me?.presence.online ?? false;

  useEffect(() => {
    if (raw.until === null) return;
    const tick = () => {
      const t = nowMs();
      setNow(t);
      const cur = breakStore.get();
      if (cur.until !== null && cur.until <= t && endedRef.current !== cur.until) {
        endedRef.current = cur.until;
        breakStore.set({ ...cur, until: null, startedAt: null });
        toast("Break over. You are taking requests again.", "success");
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [raw.until, toast]);

  // Going offline ends a break (only once the account has loaded).
  const loaded = me !== null;
  useEffect(() => {
    if (loaded && !online && breakStore.get().until !== null) breakStore.set((c) => ({ ...c, until: null, startedAt: null }));
  }, [loaded, online]);

  if (raw.until === null || now === 0 || raw.until <= now) return null;
  const s = forToday(raw);
  const leftSec = Math.ceil((raw.until - now) / 1000);
  const canExtend = s.usedMin + 5 <= BREAK_DAILY_MIN;

  const endNow = () => {
    // Give back unused whole minutes to today's allowance.
    const unused = Math.floor(leftSec / 60);
    breakStore.set({ ...s, until: null, startedAt: null, usedMin: Math.max(0, s.usedMin - unused) });
    toast("Welcome back. You are taking requests again.", "success");
  };
  const extend = () => {
    if (!canExtend || raw.until === null) return;
    breakStore.set({ ...s, until: raw.until + 5 * 60000, usedMin: s.usedMin + 5 });
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }} role="status">
      <Coffee size={18} style={{ color: "var(--a-gold)" }} />
      <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}>
        <b>On a break</b> until {clockOf(raw.until)} ({Math.floor(leftSec / 60)}:{String(leftSec % 60).padStart(2, "0")} left). No new requests. {s.keepQueue ? "Waitlist is open." : "Waitlist is closed."}
      </p>
      <AdminButton variant="outline" onClick={extend} disabled={!canExtend}><Plus size={15} /> 5 min</AdminButton>
      <AdminButton onClick={endNow}><Play size={15} /> I am back</AdminButton>
    </div>
  );
}

/** Hook for pages: is the partner on a break right now? */
export function useOnBreak() {
  const raw = useStore(breakStore);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (raw.until === null) return;
    const id = setInterval(() => setNow(nowMs()), 1000);
    const first = setTimeout(() => setNow(nowMs()), 0);
    return () => { clearInterval(id); clearTimeout(first); };
  }, [raw.until]);
  return { onBreak: raw.until !== null && (now === 0 || raw.until > now), keepQueue: raw.keepQueue, until: raw.until };
}
