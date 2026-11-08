"use client";

/**
 * Live (DEMO audience; your camera preview is real). Go live, talk to many
 * people at once, receive gifts, and take private calls from a call queue.
 *
 * Rules covered:
 *   • only approved partners, not during a live session or a break
 *   • title 5–80 chars (contact details masked), up to 3 topics
 *   • private call rate within ₹5 and your max rate; caller needs balance for
 *     5 minutes; FIFO call queue; one call at a time; turning calls off clears
 *     the queue (callers are told, never charged)
 *   • comments: contact details masked, abusive words auto-hidden, slow mode,
 *     followers-only, pin, hide, mute for this live, block
 *   • "Be right back" pause (gifts and comments stop), auto-end at 3 hours
 *   • gifts: you get GIFT_SHARE_PCT %; scheduling a live notifies followers
 *   • lives are recorded for safety review and kept for 30 days
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Camera, CameraOff, Eye, Gift, Heart, Mic, MicOff, Pause, Pin, Phone, PhoneOff, Play, Radio, Send, ShieldAlert, Trash2, UserX, Users, VolumeX, X } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, Modal, PageHeader, StatCard, StatsSkeleton, Tabs, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DEMO_SESSION_KEY, DemoBanner, fmtDateTime, inr, maskContacts, nowMs } from "../../_components/demo";
import { blockedStore, breakStore, createStore, liveStore, LIVE_MAX_MIN, useStore, type LiveState } from "../../_components/demo-store";
import { GIFTS, GIFT_SHARE_PCT, MOCK_LIVES, MOCK_REQUEST_POOL } from "../../_components/mock-data";

const TOPICS = ["Career", "Love", "Marriage", "Money", "Health", "Remedies", "Gochar", "Tarot"];
const BAD_WORDS = ["idiot", "fraud", "bakwas", "chor", "pagal"];
const MIN_CALL_MIN = 5;
const COMMENT_LINES = [
  "Namaste guruji 🙏", "Meri shaadi kab hogi? DOB 12-08-1996", "Job change ka yog hai kya?", "Aapki baatein sach hoti hain",
  "Mera number 98765 43210 hai, call karo", "Shani ki sade sati kab khatam hogi?", "bakwas hai sab", "Kumbh rashi ke liye kya upay?",
  "Thank you ji, bahut accha bataya", "Mangal dosh ka upay batao please", "pay me at riya@okaxis", "Private call lena hai",
];
const VIEWER_NAMES = ["Anu", "Ravi", "Sonal", "Harsh", "Meena", "Tarun", "Gauri", "Imran", "Lata", "Kunal", "Priti", "Arjun"];

interface Comment { id: string; user: string; text: string; at: number; hidden?: "masked" | "filtered" | "manual"; host?: boolean }
interface Caller { id: string; user: string; customerId: string; walletMinutes: number; joinedAt: number; question: string }
interface GiftEvent { id: string; user: string; giftId: (typeof GIFTS)[number]["id"]; at: number }
interface Scheduled { id: string; title: string; at: string }

const scheduledStore = createStore<Scheduled[]>("astro_demo_live_scheduled", []);
const rid = () => Math.random().toString(36).slice(2, 9);
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); return `${h ? `${h}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const giftOf = (id: string) => GIFTS.find((g) => g.id === id) ?? GIFTS[0];

export default function LivePage() {
  const { me, loading } = usePartner();
  const live = useStore(liveStore);
  if (loading || !me) return <StatsSkeleton count={3} />;
  return live ? <LiveStage live={live} maxRate={me.effectiveMaxRate} pct={me.effectiveCommissionPct} /> : <LiveSetup />;
}

/* ------------------------------------------------------------------ *
 * Setup
 * ------------------------------------------------------------------ */
function LiveSetup() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const scheduled = useStore(scheduledStore);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allowCalls, setAllowCalls] = useState(true);
  const [callRate, setCallRate] = useState(String(me?.rates.call || 30));
  const [slowMode, setSlowMode] = useState(false);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [agree, setAgree] = useState(false);
  const [when, setWhen] = useState("");
  const [last, setLast] = useState<(typeof MOCK_LIVES)[number] | null>(null);
  if (!me) return null;

  const cleanTitle = maskContacts(title.trim());
  const rate = Number(callRate);
  const rateOk = !allowCalls || (Number.isInteger(rate) && rate >= 5 && rate <= me.effectiveMaxRate);
  const titleOk = cleanTitle.length >= 5 && cleanTitle.length <= 80;
  const approved = me.status === "approved";
  const canStart = approved && titleOk && rateOk && agree;

  const goLive = () => {
    if (!canStart) return;
    if (sessionStorage.getItem(DEMO_SESSION_KEY)) return toast("Finish your live session first.", "error");
    const b = breakStore.get();
    if (b.until !== null && b.until > nowMs()) return toast("End your break before going live.", "error");
    const s: LiveState = { id: `lv_${nowMs()}`, title: cleanTitle, tags, startedAt: nowMs(), allowCalls, callRate: allowCalls ? rate : 0, slowMode, followersOnly, paused: false };
    liveStore.set(s);
    toast("You are live. Your followers were notified.", "success");
  };

  const schedule = () => {
    if (!titleOk) return toast("Add a title first (5 to 80 characters)", "error");
    const t = Date.parse(when);
    const n = nowMs();
    if (!Number.isFinite(t) || t < n + 30 * 60000 || t > n + 14 * 86400000) return toast("Pick a time between 30 minutes and 14 days from now", "error");
    if (scheduled.some((x) => Math.abs(Date.parse(x.at) - t) < 60 * 60000)) return toast("You already have a live within an hour of that time", "error");
    scheduledStore.set((l) => [...l, { id: rid(), title: cleanTitle, at: new Date(t).toISOString() }].sort((a, b) => a.at.localeCompare(b.at)));
    setWhen("");
    toast("Scheduled. Followers get a reminder now and 10 minutes before.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Go live" subtitle="Talk to many people at once, get gifts and take private calls" />
      <DemoBanner what="Viewers, comments and gifts on this page" />
      {!approved && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">Live is available after your profile is approved.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="space-y-4 p-5">
          <Field label="Title" hint={`${cleanTitle.length}/80 · what will you talk about?`}>
            <AdminInput value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="e.g. Shani gochar 2026: kya badlega?" />
          </Field>
          <Field label="Topics (up to 3)">
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((t) => {
                const on = tags.includes(t);
                return <button key={t} type="button" aria-pressed={on} disabled={!on && tags.length >= 3} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} className="rounded-full border px-3 py-1 text-xs disabled:opacity-40" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", color: on ? "var(--a-gold)" : "var(--a-muted)" }}>{t}</button>;
              })}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Toggle checked={allowCalls} onChange={setAllowCalls} label="Allow private calls from viewers" />
              {allowCalls && (
                <Field label="Call rate (₹/min)" hint={`₹5 to ₹${me.effectiveMaxRate}`}>
                  <AdminInput inputMode="numeric" value={callRate} onChange={(e) => setCallRate(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </Field>
              )}
              {!rateOk && <p className="text-xs text-rose-700">Rate must be a whole number from ₹5 to ₹{me.effectiveMaxRate}.</p>}
            </div>
            <div className="space-y-3">
              <Toggle checked={slowMode} onChange={setSlowMode} label="Slow mode (1 comment per 10 s each)" />
              <Toggle checked={followersOnly} onChange={setFollowersOnly} label="Only followers can comment" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm" style={{ color: "var(--a-fg)" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            I will not share contact details, scare viewers, promise results or ask for money outside gifts and calls. I understand lives are recorded for safety and kept for 30 days.
          </label>
          <div className="flex flex-wrap gap-2">
            <AdminButton onClick={goLive} disabled={!canStart}><Radio size={16} /> Go live now</AdminButton>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Camera size={16} /> Camera check</p>
            <CameraPreview on height={170} />
          </Card>
          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CalendarClock size={16} /> Schedule a live</p>
            <AdminInput type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Live date and time" />
            <AdminButton variant="outline" onClick={schedule}>Schedule with this title</AdminButton>
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                <span>{fmtDateTime(s.at)} · {s.title}</span>
                <button type="button" aria-label="Cancel scheduled live" onClick={() => { scheduledStore.set((l) => l.filter((x) => x.id !== s.id)); toast("Cancelled. Followers were told.", "info"); }} className="text-rose-600"><X size={15} /></button>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Past lives</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Live</th><th className="text-right font-medium">Minutes</th><th className="text-right font-medium">Peak</th><th className="text-right font-medium">Viewers</th><th className="text-right font-medium">New followers</th><th className="text-right font-medium">Gifts (your share)</th><th className="text-right font-medium">Calls</th></tr></thead>
            <tbody>
              {MOCK_LIVES.map((l) => (
                <tr key={l.id} className="cursor-pointer border-t hover:bg-black/[0.02]" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }} onClick={() => setLast(l)}>
                  <td className="py-2.5"><span className="font-medium">{l.title}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(l.at)}</span></td>
                  <td className="text-right">{l.minutes}</td><td className="text-right">{l.peak}</td><td className="text-right">{l.unique.toLocaleString("en-IN")}</td><td className="text-right">+{l.newFollowers}</td>
                  <td className="text-right">{inr(Math.round((l.gifts * GIFT_SHARE_PCT) / 100))}</td><td className="text-right">{l.calls} · {inr(l.callEarning)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal open={!!last} onClose={() => setLast(null)} title={last?.title ?? ""} subtitle={last ? fmtDateTime(last.at) : undefined} size="sm">
        {last && <p className="text-sm" style={{ color: "var(--a-muted)" }}>Recording kept until {new Date(Date.parse(last.at) + 30 * 86400000).toLocaleDateString("en-IN")} for safety review only. It is never shown publicly.</p>}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Live stage
 * ------------------------------------------------------------------ */
function LiveStage({ live, maxRate, pct }: { live: LiveState; maxRate: number; pct: number }) {
  const { toast } = useAdminToast();
  const [now, setNow] = useState(0);
  const [viewers, setViewers] = useState(0);
  const [peak, setPeak] = useState(0);
  const [unique, setUnique] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pinned, setPinned] = useState<Comment | null>(null);
  const [muted, setMuted] = useState<string[]>([]);
  const [queue, setQueue] = useState<Caller[]>([]);
  const [call, setCall] = useState<(Caller & { startedAt: number }) | null>(null);
  const [callsDone, setCallsDone] = useState<{ user: string; minutes: number; earned: number }[]>([]);
  const [gifts, setGifts] = useState<GiftEvent[]>([]);
  const [burst, setBurst] = useState<GiftEvent | null>(null);
  const [tab, setTab] = useState<"comments" | "calls" | "gifts">("comments");
  const [hostText, setHostText] = useState("");
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<null | { minutes: number; peak: number; unique: number; followers: number; gifts: number; giftShare: number; calls: number; callEarning: number }>(null);
  const tick = useRef(0);
  const mutedRef = useRef<string[]>([]);
  const liveRef = useRef(live);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { liveRef.current = live; }, [live]);

  useOnMount(() => setNow(nowMs()));

  // Demo audience simulation + clock.
  useEffect(() => {
    if (summary) return;
    const id = setInterval(() => {
      tick.current += 1;
      const t = nowMs();
      setNow(t);
      const L = liveRef.current;
      if (L.paused) { setViewers((v) => Math.max(0, v - 2)); return; }
      setViewers((v) => { const next = Math.max(3, v + Math.round(Math.random() * 14 - 5)); setPeak((p) => Math.max(p, next)); return next; });
      setUnique((u) => u + Math.round(Math.random() * 4));
      if (tick.current % 9 === 0) setFollowers((f) => f + 1);
      // Slow mode and followers-only both thin out comments.
      if (tick.current % ((L.slowMode ? 2 : 1) * (L.followersOnly ? 2 : 1) * 3) === 0) {
        const user = VIEWER_NAMES[Math.floor(Math.random() * VIEWER_NAMES.length)];
        if (!mutedRef.current.includes(user)) {
          const raw = COMMENT_LINES[Math.floor(Math.random() * COMMENT_LINES.length)];
          const masked = maskContacts(raw);
          const filtered = BAD_WORDS.some((w) => raw.toLowerCase().includes(w));
          setComments((c) => [...c.slice(-80), { id: rid(), user, text: filtered ? raw : masked, at: t, hidden: filtered ? "filtered" : masked !== raw ? "masked" : undefined }]);
        }
      }
      if (tick.current % 7 === 0 && Math.random() < 0.7) {
        const g = GIFTS[Math.random() < 0.6 ? Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2)];
        const ev = { id: rid(), user: VIEWER_NAMES[Math.floor(Math.random() * VIEWER_NAMES.length)], giftId: g.id, at: t };
        setGifts((l) => [ev, ...l]);
        setBurst(ev);
      }
      if (L.allowCalls && tick.current % 15 === 0) {
        const r = MOCK_REQUEST_POOL[Math.floor(Math.random() * MOCK_REQUEST_POOL.length)];
        const blocked = blockedStore.get().some((b) => b.customerId === r.customerId);
        setQueue((q) => (blocked || q.some((x) => x.customerId === r.customerId) || q.length >= 10 ? q : [...q, { id: rid(), user: r.customer, customerId: r.customerId, walletMinutes: Math.round((r.walletMinutes * r.rate) / L.callRate), joinedAt: t, question: r.question }]));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [summary]);

  // Clear the gift burst after a moment.
  useEffect(() => { if (!burst) return; const t = setTimeout(() => setBurst(null), 2200); return () => clearTimeout(t); }, [burst]);

  const elapsed = now ? now - live.startedAt : 0;
  const leftMin = LIVE_MAX_MIN - Math.floor(elapsed / 60000);
  const giftGross = gifts.reduce((a, g) => a + giftOf(g.giftId).price, 0);
  const giftShare = Math.round((giftGross * GIFT_SHARE_PCT) / 100);
  const callMin = call && now ? Math.max(1, Math.ceil((now - call.startedAt) / 60000)) : 0;
  const callEarnNow = Math.round(callMin * live.callRate * (100 - pct)) / 100;
  const callEarnDone = callsDone.reduce((a, c) => a + c.earned, 0);
  const callerOutOfMoney = call ? callMin >= call.walletMinutes : false;

  function endCall(reason?: string) {
    if (!call) return;
    setCallsDone((l) => [...l, { user: call.user, minutes: callMin, earned: callEarnNow }]);
    setCall(null);
    toast(reason ?? `Call with ${call.user} ended · you earned ${inr(callEarnNow)}`, "info");
  }

  function end(reason: string) {
    if (summary) return;
    if (call) endCall();
    const m = Math.max(1, Math.round(elapsed / 60000));
    setSummary({ minutes: m, peak, unique, followers, gifts: giftGross, giftShare, calls: callsDone.length + (call ? 1 : 0), callEarning: Math.round((callEarnDone + (call ? callEarnNow : 0)) * 100) / 100 });
    if (queue.length) toast(`${queue.length} callers in the queue were told the live ended. No one was charged.`, "info");
    setQueue([]);
    setConfirmEnd(false);
    toast(reason, "info");
  }

  // Auto end + call cut-off (deferred so no state is set during render).
  const endRef = useRef(end);
  const endCallRef = useRef(endCall);
  useEffect(() => { endRef.current = end; endCallRef.current = endCall; });
  useEffect(() => {
    if (summary || !now) return;
    if (leftMin <= 0) { const t = setTimeout(() => endRef.current(`Live ended automatically after ${LIVE_MAX_MIN / 60} hours`), 0); return () => clearTimeout(t); }
    if (callerOutOfMoney) { const t = setTimeout(() => endCallRef.current("Caller's balance ran out. Call ended."), 0); return () => clearTimeout(t); }
  }, [leftMin, callerOutOfMoney, summary, now]);

  const takeCall = (c: Caller) => {
    if (call) return toast("Finish the current call first", "error");
    if (c.walletMinutes < MIN_CALL_MIN) { setQueue((q) => q.filter((x) => x.id !== c.id)); return toast(`${c.user} has balance for under ${MIN_CALL_MIN} min and was asked to recharge`, "error"); }
    setQueue((q) => q.filter((x) => x.id !== c.id));
    setCall({ ...c, startedAt: nowMs() });
    setTab("comments");
  };
  const setLive = (patch: Partial<LiveState>) => liveStore.set((cur) => (cur ? { ...cur, ...patch } : cur));
  const toggleCalls = (v: boolean) => {
    if (!v && queue.length) { toast(`${queue.length} callers removed and told. No charge.`, "info"); setQueue([]); }
    setLive({ allowCalls: v });
  };
  const postHost = () => {
    const t = hostText.trim();
    if (!t) return;
    const clean = maskContacts(t);
    if (clean !== t) toast("Contact details are not allowed. They were hidden.", "error");
    setComments((c) => [...c, { id: rid(), user: "You", text: clean.slice(0, 200), at: nowMs(), host: true }]);
    setHostText("");
  };
  const hide = (id: string) => setComments((c) => c.map((x) => (x.id === id ? { ...x, hidden: "manual" } : x)));
  const muteUser = (u: string) => { setMuted((m) => [...m, u]); setComments((c) => c.map((x) => (x.user === u ? { ...x, hidden: "manual" } : x))); toast(`${u} is muted for this live`, "info"); };

  if (summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live ended" subtitle={live.title} />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard icon={Radio} value={`${summary.minutes} min`} label="Duration" tone="royal" />
          <StatCard icon={Eye} value={summary.peak} label={`Peak viewers (${summary.unique} total)`} tone="blue" />
          <StatCard icon={Heart} value={`+${summary.followers}`} label="New followers" tone="rose" />
          <StatCard icon={Gift} value={inr(summary.giftShare + summary.callEarning)} label="You earned" tone="green" />
        </div>
        <Card className="p-5">
          <dl className="grid max-w-md grid-cols-2 gap-y-2 text-sm">
            <dt style={{ color: "var(--a-muted)" }}>Gifts received</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(summary.gifts)}</dd>
            <dt style={{ color: "var(--a-muted)" }}>Your gift share ({GIFT_SHARE_PCT}%)</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(summary.giftShare)}</dd>
            <dt style={{ color: "var(--a-muted)" }}>Private calls ({summary.calls})</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(summary.callEarning)}</dd>
            <dt className="border-t pt-2 font-semibold" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>Total</dt><dd className="border-t pt-2 text-right font-semibold text-emerald-700" style={{ borderColor: "var(--a-border)" }}>{inr(summary.giftShare + summary.callEarning)}</dd>
          </dl>
          <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Live earnings follow the same hold period as sessions. The recording is kept 30 days for safety review only.</p>
          <div className="mt-4 flex gap-2">
            <AdminButton onClick={() => liveStore.set(null)}>Done</AdminButton>
            <Link href="/astrologer/earnings"><AdminButton variant="outline">See earnings</AdminButton></Link>
          </div>
        </Card>
      </div>
    );
  }

  const visible = comments.filter((c) => c.hidden !== "manual");

  return (
    <div className="space-y-4">
      <DemoBanner what="Viewers, comments and gifts" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard icon={Eye} value={viewers} label={`Watching (peak ${peak})`} tone="blue" />
        <StatCard icon={Heart} value={`+${followers}`} label="New followers" tone="rose" />
        <StatCard icon={Gift} value={inr(giftShare)} label={`Gifts (your ${GIFT_SHARE_PCT}%)`} tone="gold" />
        <StatCard icon={Phone} value={inr(Math.round((callEarnDone + callEarnNow) * 100) / 100)} label={`Calls (${callsDone.length + (call ? 1 : 0)})`} tone="green" />
        <StatCard icon={Users} value={queue.length} label="In call queue" tone="royal" />
      </div>
      {leftMin <= 10 && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800" role="alert">This live ends automatically in {Math.max(0, leftMin)} minutes (3 hour limit).</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card className="p-0">
          <div className="relative overflow-hidden rounded-t-lg bg-black">
            <CameraPreview on={cam} height={420} />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white"><Radio size={12} /> LIVE</span>
              <span className="rounded-md bg-black/60 px-2 py-0.5 text-xs text-white tabular-nums">{clock(elapsed)}</span>
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white"><Eye size={12} /> {viewers}</span>
              {!mic && <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white"><MicOff size={12} /> Muted</span>}
            </div>
            <p className="absolute inset-x-3 bottom-3 truncate rounded-md bg-black/50 px-2 py-1 text-sm text-white">{live.title}</p>
            {live.paused && <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-lg font-semibold text-white">Be right back</div>}
            {burst && <div className="absolute right-4 top-16 animate-bounce rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-lg" aria-live="polite">{giftOf(burst.giftId).emoji} {burst.user} sent {giftOf(burst.giftId).name}</div>}
            {call && (
              <div className="absolute inset-x-3 bottom-12 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-600/95 px-3 py-2 text-sm text-white">
                <Phone size={15} /> On call with <b>{call.user}</b> · {clock(now - call.startedAt)} · {inr(callEarnNow)}
                {call.walletMinutes - callMin <= 1 && <span className="rounded bg-white/20 px-1.5 text-xs">balance almost over</span>}
                <button type="button" onClick={() => endCall()} className="ml-auto flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-xs"><PhoneOff size={13} /> End call</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <AdminButton variant={mic ? "outline" : "danger"} onClick={() => setMic((v) => !v)} aria-pressed={!mic}>{mic ? <Mic size={16} /> : <MicOff size={16} />}{mic ? "Mute" : "Unmute"}</AdminButton>
            <AdminButton variant={cam ? "outline" : "danger"} onClick={() => setCam((v) => !v)} aria-pressed={!cam}>{cam ? <Camera size={16} /> : <CameraOff size={16} />}{cam ? "Camera off" : "Camera on"}</AdminButton>
            <AdminButton variant="outline" onClick={() => setLive({ paused: !live.paused })}>{live.paused ? <Play size={16} /> : <Pause size={16} />}{live.paused ? "Resume" : "Be right back"}</AdminButton>
            <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
              <Toggle checked={live.allowCalls} onChange={toggleCalls} label="Calls" />
              <Toggle checked={live.slowMode} onChange={(v) => setLive({ slowMode: v })} label="Slow mode" />
              <Toggle checked={live.followersOnly} onChange={(v) => setLive({ followersOnly: v })} label="Followers only" />
            </div>
            <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}><X size={16} /> End live</AdminButton>
          </div>
        </Card>

        <Card className="flex h-[560px] flex-col p-0">
          <div className="px-2"><Tabs tabs={[{ value: "comments", label: "Comments" }, { value: "calls", label: "Call queue", count: queue.length }, { value: "gifts", label: "Gifts", count: gifts.length }]} value={tab} onChange={setTab} /></div>
          {tab === "comments" && (
            <>
              {pinned && <div className="mx-3 mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-gold-soft)", color: "var(--a-fg)" }}><Pin size={14} className="mt-0.5" /><span className="flex-1"><b>{pinned.user}:</b> {pinned.text}</span><button type="button" aria-label="Unpin" onClick={() => setPinned(null)}><X size={14} /></button></div>}
              <ul className="flex-1 space-y-1.5 overflow-y-auto p-3 text-sm" aria-live="polite">
                {visible.slice(-40).map((c) => (
                  <li key={c.id} className="group flex items-start gap-2">
                    <span className="min-w-0 flex-1" style={{ color: "var(--a-fg)" }}>
                      <b style={{ color: c.host ? "var(--a-gold)" : undefined }}>{c.user}</b>{" "}
                      {c.hidden === "filtered" ? <i style={{ color: "var(--a-faint)" }}>Hidden by the filter</i> : c.text}
                      {c.hidden === "masked" && <Badge tone="gold">contact hidden</Badge>}
                    </span>
                    {!c.host && c.hidden !== "filtered" && (
                      <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" aria-label="Pin comment" onClick={() => setPinned(c)}><Pin size={13} /></button>
                        <button type="button" aria-label="Hide comment" onClick={() => hide(c.id)}><Trash2 size={13} /></button>
                        <button type="button" aria-label={`Mute ${c.user}`} onClick={() => muteUser(c.user)}><VolumeX size={13} /></button>
                        <button type="button" aria-label={`Block ${c.user}`} onClick={() => { muteUser(c.user); blockedStore.set((l) => [{ customerId: `viewer_${c.user}`, name: c.user, reason: "Blocked during live", at: new Date(nowMs()).toISOString() }, ...l]); }}><UserX size={13} /></button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <form className="flex gap-2 border-t p-3" style={{ borderColor: "var(--a-border)" }} onSubmit={(e) => { e.preventDefault(); postHost(); }}>
                <AdminInput value={hostText} onChange={(e) => setHostText(e.target.value.slice(0, 200))} placeholder="Say something to everyone" aria-label="Host comment" />
                <AdminButton type="submit" disabled={!hostText.trim()} aria-label="Post"><Send size={15} /></AdminButton>
              </form>
              <p className="flex items-center gap-1 px-3 pb-2 text-[11px]" style={{ color: "var(--a-faint)" }}><ShieldAlert size={11} /> Contact details are hidden and abusive words filtered automatically. {muted.length ? `${muted.length} muted.` : ""}</p>
            </>
          )}
          {tab === "calls" && (
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {!live.allowCalls && <p className="text-sm" style={{ color: "var(--a-muted)" }}>Private calls are off.</p>}
              {live.allowCalls && queue.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No one in the queue. Viewers can request a call at ₹{live.callRate}/min.</p>}
              {queue.map((q, i) => (
                <div key={q.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: i === 0 ? "var(--a-gold)" : "var(--a-border)" }}>
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>#{i + 1} {q.user}</p>
                  <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>&ldquo;{q.question}&rdquo;</p>
                  <p className="text-[11px]" style={{ color: q.walletMinutes < MIN_CALL_MIN ? "#be123c" : "var(--a-faint)" }}>Balance for ~{q.walletMinutes} min at ₹{live.callRate}/min</p>
                  <div className="mt-2 flex gap-2">
                    {i === 0 && <AdminButton onClick={() => takeCall(q)} disabled={!!call}><Phone size={14} /> Take call</AdminButton>}
                    <AdminButton variant="ghost" onClick={() => { setQueue((l) => l.filter((x) => x.id !== q.id)); toast(`${q.user} removed and told. No charge.`, "info"); }}>Remove</AdminButton>
                  </div>
                </div>
              ))}
              <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>First come, first served. Calls are heard on the live; the caller is billed only while connected. Rate is fixed for this live (max ₹{maxRate}).</p>
            </div>
          )}
          {tab === "gifts" && (
            <div className="flex-1 overflow-y-auto p-3 text-sm">
              <p className="mb-2 text-xs" style={{ color: "var(--a-muted)" }}>Gifts total {inr(giftGross)} · you get {GIFT_SHARE_PCT}% = {inr(giftShare)}</p>
              <TopGifters gifts={gifts} />
              <ul className="mt-3 space-y-1">
                {gifts.slice(0, 40).map((g) => <li key={g.id} style={{ color: "var(--a-fg)" }}>{giftOf(g.giftId).emoji} <b>{g.user}</b> sent {giftOf(g.giftId).name} · {inr(giftOf(g.giftId).price)}</li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End the live?" subtitle={call ? "Your current call will also end." : queue.length ? `${queue.length} callers in the queue will be told. No one is charged.` : undefined} size="sm">
        <div className="grid grid-cols-2 gap-2">
          <AdminButton variant="ghost" onClick={() => setConfirmEnd(false)}>Stay live</AdminButton>
          <AdminButton variant="danger" onClick={() => end("Live ended")}>End live</AdminButton>
        </div>
      </Modal>
    </div>
  );
}

function TopGifters({ gifts }: { gifts: GiftEvent[] }) {
  const totals = new Map<string, number>();
  gifts.forEach((g) => totals.set(g.user, (totals.get(g.user) ?? 0) + giftOf(g.giftId).price));
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return <p style={{ color: "var(--a-faint)" }}>No gifts yet.</p>;
  return (
    <ol className="space-y-1">
      {top.map(([u, v], i) => <li key={u} className="flex justify-between rounded-md px-2 py-1" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}><span>{["🥇", "🥈", "🥉"][i]} {u}</span><span>{inr(v)}</span></li>)}
    </ol>
  );
}

/** Real local camera preview with clear errors. */
function CameraPreview({ on, height }: { on: boolean; height: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) { const t = setTimeout(() => setErr("This browser cannot use the camera."), 0); return () => clearTimeout(t); }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      setErr(null);
      if (ref.current) ref.current.srcObject = s;
    }).catch((e: unknown) => {
      const n = e instanceof DOMException ? e.name : "";
      setErr(n === "NotAllowedError" ? "Camera permission denied. Allow it from the address bar." : n === "NotFoundError" ? "No camera found." : "Could not start the camera.");
    });
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);
  return (
    <div className="flex w-full items-center justify-center overflow-hidden rounded-lg bg-zinc-900 text-sm text-white/70" style={{ height }}>
      {on && !err ? <video ref={ref} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera" /> : <span className="px-4 text-center">{err ?? "Camera is off"}</span>}
    </div>
  );
}
