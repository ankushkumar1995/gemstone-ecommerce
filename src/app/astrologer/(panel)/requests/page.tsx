"use client";

/**
 * Live requests (DEMO). Incoming chat/call requests with a ring, a browser
 * notification, a countdown and Accept / Reject. A request that is not answered
 * in time becomes "Missed"; after N misses in a row the partner is set offline.
 * Only one live session at a time: Accept is disabled while one is running.
 *
 * Demo: "Simulate request" (or auto demo) creates requests locally. When the
 * consultation backend is live, the list comes from polling the server instead.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Check, MessageCircle, Phone, Video, Volume2, VolumeX, X, Wallet, Repeat2, Bell, Sparkles } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, CHANNEL_LABEL, DEMO_SESSION_KEY, timeAgo } from "../../_components/demo";
import { MOCK_REQUEST_POOL, type MockRequest } from "../../_components/mock-data";
import { blockedStore, breakStore, liveStore, queueStore, useStore } from "../../_components/demo-store";
import { tryJoin } from "../../_components/queue";

const TIMEOUT_SEC = 60;
const MAX_MISSED = 3;

type Live = MockRequest & { uid: string; arrivedAt: number; expiresAt: number };
type Done = Live & { outcome: "missed" | "rejected" | "accepted"; at: string; reason?: string };

const ICON = { chat: MessageCircle, call: Phone, video: Video } as const;
const REJECT_REASONS = ["Busy right now", "Outside my expertise", "Taking a break", "Other"];

export default function LiveRequestsPage() {
  const { me, loading, goOffline } = usePartner();
  const { toast } = useAdminToast();
  const router = useRouter();
  const [requests, setRequests] = useState<Live[]>([]);
  const [history, setHistory] = useState<Done[]>([]);
  const [now, setNow] = useState(0);
  const [sound, setSound] = useState(false);
  const [autoDemo, setAutoDemo] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");
  const [hasActive, setHasActive] = useState(false);
  const [streak, setStreak] = useState(0);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const queueLen = useStore(queueStore).length;

  const reqRef = useRef<Live[]>([]);
  const streakRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const seq = useRef(0);
  const onlineRef = useRef(false);
  const addRef = useRef<() => void>(() => undefined);

  useEffect(() => { reqRef.current = requests; }, [requests]);
  useEffect(() => { onlineRef.current = me?.presence.online ?? false; }, [me?.presence.online]);

  useOnMount(() => {
    setNow(Date.now());
    setNotifPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    setHasActive(Boolean(sessionStorage.getItem(DEMO_SESSION_KEY)));
  });

  // 1s tick: countdowns + expiry → missed (+ auto offline after MAX_MISSED in a row).
  useEffect(() => {
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const list = reqRef.current;
      const expired = list.filter((r) => r.expiresAt <= ts);
      if (!expired.length) return;
      reqRef.current = list.filter((r) => r.expiresAt > ts);
      setRequests(reqRef.current);
      setHistory((h) => [...expired.map((r) => ({ ...r, outcome: "missed" as const, at: new Date(ts).toISOString() })), ...h].slice(0, 50));
      streakRef.current += expired.length;
      setStreak(streakRef.current);
      if (streakRef.current >= MAX_MISSED && onlineRef.current) {
        void goOffline();
        toast(`${MAX_MISSED} requests missed in a row. You were set offline.`, "error");
      } else toast(`Missed a request from ${expired[0].customer}`, "error");
    }, 1000);
    return () => clearInterval(t);
  }, [goOffline, toast]);

  // Ring while something is waiting (two short beeps every 2.5s).
  useEffect(() => {
    if (!sound || requests.length === 0) return;
    const ring = () => {
      const ctx = audioRef.current;
      if (!ctx) return;
      [0, 0.28].forEach((offset) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + offset);
        o.stop(ctx.currentTime + offset + 0.25);
      });
    };
    ring();
    const t = setInterval(ring, 2500);
    return () => clearInterval(t);
  }, [sound, requests.length]);

  // Auto demo: a new request every 25s.
  useEffect(() => {
    if (!autoDemo) return;
    const t = setInterval(() => addRef.current(), 25_000);
    return () => clearInterval(t);
  }, [autoDemo]);
  useEffect(() => { addRef.current = addRequest; });

  function addRequest() {
    const base = MOCK_REQUEST_POOL[seq.current % MOCK_REQUEST_POOL.length];
    seq.current += 1;
    // Blocked customers can never reach you.
    if (blockedStore.get().some((b) => b.customerId === base.customerId)) {
      toast(`A request from ${base.customer} was filtered out (blocked by you).`, "info");
      return;
    }
    // Live: one-to-one requests are paused; customers are invited to the live and its call queue.
    if (liveStore.get()) {
      toast(`You are live. ${base.customer} was invited to join your live and its call queue.`, "info");
      return;
    }
    // On a break: customers see "back at …" and may join the waitlist instead.
    const brk = breakStore.get();
    if (brk.until !== null && brk.until > Date.now()) {
      const res = tryJoin({ ...base }, { acceptingQueue: brk.keepQueue });
      toast(res.ok ? `You are on a break. ${base.customer} joined your waitlist at #${res.position}.` : `You are on a break. ${base.customer} could not wait: ${res.reason}.`, "info");
      return;
    }
    // Busy in a session: the customer is offered the waitlist instead of ringing you.
    if (sessionStorage.getItem(DEMO_SESSION_KEY)) {
      const res = tryJoin({ ...base }, { acceptingQueue: onlineRef.current });
      toast(res.ok ? `You are busy. ${base.customer} joined your waitlist at #${res.position}.` : `You are busy. ${base.customer} could not wait: ${res.reason}.`, "info");
      return;
    }
    const ts = Date.now();
    const r: Live = { ...base, uid: `${base.id}-${ts}`, arrivedAt: ts, expiresAt: ts + TIMEOUT_SEC * 1000 };
    setRequests((cur) => [...cur, r]);
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(`New ${CHANNEL_LABEL[r.channel].toLowerCase()} request`, { body: `${r.customer}: ${r.question}`, tag: r.uid });
    }
  }

  async function enableSound() {
    if (!audioRef.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return toast("Sound is not supported in this browser", "error");
      audioRef.current = new Ctor();
    }
    await audioRef.current.resume();
    setSound(true);
  }

  async function askNotif() {
    if (typeof Notification === "undefined") return;
    setNotifPerm(await Notification.requestPermission());
  }

  function accept(r: Live) {
    if (hasActive) return toast("Finish your current session first. One session at a time.", "error");
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ ...r, startedAt: Date.now() }));
    streakRef.current = 0;
    setStreak(0);
    setRequests((cur) => cur.filter((x) => x.uid !== r.uid));
    setHistory((h) => [{ ...r, outcome: "accepted" as const, at: new Date().toISOString() }, ...h]);
    router.push("/astrologer/session");
  }

  function reject(r: Live, reason: string) {
    setRejecting(null);
    streakRef.current = 0;
    setStreak(0);
    setRequests((cur) => cur.filter((x) => x.uid !== r.uid));
    setHistory((h) => [{ ...r, outcome: "rejected" as const, at: new Date().toISOString(), reason }, ...h]);
    toast("Request declined. The customer can pick another astrologer.", "info");
  }

  if (loading || !me) return <StatsSkeleton count={3} />;
  const online = me.presence.online;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live requests"
        subtitle={`Answer within ${TIMEOUT_SEC} seconds. ${MAX_MISSED} misses in a row sets you offline.`}
        action={<AdminButton variant="outline" onClick={addRequest}><Sparkles size={15} /> Simulate request</AdminButton>}
      />
      <DemoBanner />

      {/* readiness */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className={`h-3 w-3 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{online ? "You are online" : "You are offline"}</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>{online ? "Customers can send requests" : "Use the switch at the top to go online"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          {sound ? <Volume2 size={18} className="text-emerald-600" /> : <VolumeX size={18} style={{ color: "var(--a-muted)" }} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Ring sound</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Browsers need one click to allow sound</p>
          </div>
          {sound ? <AdminButton variant="ghost" onClick={() => setSound(false)}>Mute</AdminButton> : <AdminButton onClick={enableSound}>Turn on</AdminButton>}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Bell size={18} style={{ color: notifPerm === "granted" ? "var(--a-green)" : "var(--a-muted)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Desktop alerts</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>
              {notifPerm === "granted" ? "On. You get an alert when this tab is in the background." : notifPerm === "denied" ? "Blocked in browser settings" : notifPerm === "unsupported" ? "Not supported here" : "Get alerts in other tabs"}
            </p>
          </div>
          {notifPerm === "default" && <AdminButton onClick={askNotif}>Allow</AdminButton>}
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--a-muted)" }}>
        <Toggle checked={autoDemo} onChange={setAutoDemo} label="Auto demo (new request every 25s)" />
        <span>Missed in a row: <b style={{ color: streak ? "#be123c" : "var(--a-fg)" }}>{streak}/{MAX_MISSED}</b></span>
        {hasActive && <Link href="/astrologer/session" className="font-medium" style={{ color: "var(--a-gold)" }}>You have a live session. Open it</Link>}
        <Link href="/astrologer/waitlist" className="font-medium" style={{ color: "var(--a-gold)" }}>Waitlist: {queueLen} waiting</Link>
      </div>

      {/* waiting */}
      <section aria-live="polite" aria-label="Waiting requests">
        {requests.length === 0 ? (
          <Card className="flex flex-col items-center py-12 text-center">
            <BellRing size={28} style={{ color: "var(--a-faint)" }} />
            <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>No one waiting</p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>New requests show up here with a ring. Keep this tab open while online.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((r) => {
              const left = Math.max(0, Math.ceil((r.expiresAt - now) / 1000));
              const pct = (left / TIMEOUT_SEC) * 100;
              const Icon = ICON[r.channel];
              return (
                <Card key={r.uid} className="relative overflow-hidden p-5 ring-2 ring-[#c9942a]">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--a-border)" }}>
                    <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: left <= 10 ? "#e11d48" : "var(--a-gold)" }} />
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}><Icon size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{r.customer}</p>
                        <Badge tone="gold">{CHANNEL_LABEL[r.channel]} · ₹{r.rate}/min</Badge>
                        {r.repeat && <Badge tone="green"><Repeat2 size={11} className="mr-1 inline" />Repeat</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm" style={{ color: "var(--a-fg)" }}>&ldquo;{r.question}&rdquo;</p>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--a-muted)" }}>
                        <span className="flex items-center gap-1"><Wallet size={12} /> Balance for about {r.walletMinutes} min</span>
                        <span>Born {r.birth.dob} · {r.birth.place}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums" style={{ color: left <= 10 ? "#e11d48" : "var(--a-fg)" }} aria-label={`${left} seconds left`}>{left}s</p>
                    </div>
                  </div>
                  {rejecting === r.uid ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {REJECT_REASONS.map((reason) => <AdminButton key={reason} variant="outline" onClick={() => reject(r, reason)}>{reason}</AdminButton>)}
                      <AdminButton variant="ghost" onClick={() => setRejecting(null)}>Back</AdminButton>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <AdminButton variant="danger" onClick={() => setRejecting(r.uid)}><X size={16} /> Reject</AdminButton>
                      <AdminButton onClick={() => accept(r)} disabled={hasActive}><Check size={16} /> Accept</AdminButton>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* recent outcomes */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Recent requests</p>
        {history.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--a-faint)" }}>Accepted, rejected and missed requests from this visit appear here.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {history.map((h) => (
              <li key={h.uid} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span style={{ color: "var(--a-fg)" }}>{h.customer} · {CHANNEL_LABEL[h.channel]}{h.reason ? ` · ${h.reason}` : ""}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={h.outcome === "accepted" ? "green" : h.outcome === "missed" ? "rose" : "muted"}>{h.outcome}</Badge>
                  <span className="text-xs" style={{ color: "var(--a-muted)" }}>{timeAgo(h.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
