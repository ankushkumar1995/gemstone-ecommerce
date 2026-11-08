"use client";

/**
 * Daily updates for a havan / anushthan booking (admin). One entry per day;
 * posting a day again replaces it. Shown to the devotee as their progress.
 */

import { useState } from "react";
import { CalendarCheck2, Flame } from "lucide-react";
import type { BookingAction } from "@/modules/poojas/pooja.schema";
import type { PoojaBooking } from "@/modules/poojas/pooja.types";
import { AdminButton, AdminInput, AdminTextarea, Card, Field } from "../../../../_components";

export function HavanProgress({ b, busy, run }: { b: PoojaBooking; busy: boolean; run: (a: BookingAction, done?: string) => Promise<boolean | void> }) {
  const days = Math.max(1, b.pooja.durationDays ?? 1);
  const list = b.progress ?? [];
  const nextDay = Math.min(days, (list.reduce((m, p) => Math.max(m, p.day), 0) || 0) + 1);
  const [day, setDay] = useState(nextDay);
  const [note, setNote] = useState("");
  const [jaap, setJaap] = useState("");
  const [video, setVideo] = useState("");
  const canPost = ["confirmed", "assigned", "in_progress", "performed"].includes(b.status);
  const pct = Math.round((list.length / days) * 100);

  const post = async () => {
    const ok = await run({ action: "progress", day, note: note.trim(), jaapDone: jaap === "" ? null : Math.max(0, Math.round(Number(jaap))), photos: [], videoUrl: video.trim() }, `Day ${day} update saved`);
    if (ok !== false) { setNote(""); setJaap(""); setVideo(""); setDay(Math.min(days, day + 1)); }
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Flame size={16} /> Havan progress</h2>
        <span className="text-xs" style={{ color: "var(--a-muted)" }}>{list.length} of {days} day{days > 1 ? "s" : ""} updated{b.pooja.mode ? ` · ${b.pooja.mode === "ekal" ? "Ekal" : "Samuhik"}` : ""}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--a-surface-2)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Anushthan progress">
        <div className="h-full rounded-full bg-gradient-to-r from-[#e6b43a] to-[#c9942a]" style={{ width: `${pct}%` }} />
      </div>

      {list.length > 0 && (
        <ol className="space-y-2">
          {list.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #e6b43a, #c9942a)" }}>{p.day}</span>
              <div className="min-w-0">
                <p style={{ color: "var(--a-fg)" }}>{p.note}</p>
                <p className="text-xs" style={{ color: "var(--a-muted)" }}>
                  {p.jaapDone !== null ? `${p.jaapDone.toLocaleString("en-IN")} jaap done · ` : ""}{new Date(p.at).toLocaleString("en-IN")} by {p.by}
                  {p.videoUrl && <> · <a href={p.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">video</a></>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canPost ? (
        <div className="space-y-3 rounded-lg p-3" style={{ background: "var(--a-surface-2)" }}>
          <div className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr]">
            <Field label="Day"><AdminInput type="number" min={1} max={days} value={day} onChange={(e) => setDay(Math.min(days, Math.max(1, Math.round(Number(e.target.value) || 1))))} /></Field>
            <Field label="Jaap done so far (optional)"><AdminInput type="number" min={0} value={jaap} onChange={(e) => setJaap(e.target.value)} placeholder="e.g. 35000" /></Field>
            <Field label="Video link (optional)"><AdminInput value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://..." /></Field>
          </div>
          <Field label="Update for the devotee"><AdminTextarea rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Day 3: 11 pandits completed 35,000 jaap and the evening havan." /></Field>
          <AdminButton disabled={busy || note.trim().length < 2} onClick={post}><CalendarCheck2 size={15} /> {list.some((p) => p.day === day) ? `Replace day ${day}` : `Post day ${day}`}</AdminButton>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Daily updates can be posted once the booking is confirmed.</p>
      )}
    </Card>
  );
}
