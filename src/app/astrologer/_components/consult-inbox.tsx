"use client";

/**
 * Chat request inbox for the whole partner panel.
 *
 * One long-poll loop (GET /astrologer/consult/inbox?sig=&wait=1) runs while an
 * approved partner has the panel open. The server answers at once when a
 * request arrives, is withdrawn, times out, or the live chat changes, so a
 * new request shows within about a second on any page.
 *
 * On a new request: ring (if sound is on), a desktop alert when the tab is in
 * the background, and a floating card on pages other than Live requests.
 * The loop backs off on errors (2s doubling to 15s) and never throws.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, MessagesSquare } from "lucide-react";
import { partnerApi, type SessionView } from "@/lib/astrologer-api";
import { useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";

const SOUND_KEY = "astro_ring_on";

interface InboxCtx {
  requests: SessionView[];
  active: SessionView | null;
  /** My live right now (from the same poll). */
  live: { id: string; title: string; startedAt: string | null } | null;
  /** People in my waitlist right now. */
  waiting: number;
  ready: boolean;
  /** Last loop error, cleared on the next good answer. */
  offlineNet: boolean;
  /** Server clock minus local clock, ms. Countdowns use it. */
  skew: number;
  refresh: () => void;
  /** Drop a request locally after Accept / Decline (the next poll confirms). */
  forget: (id: string) => void;
  sound: boolean;
  enableSound: () => Promise<boolean>;
  muteSound: () => void;
  notifPerm: NotificationPermission | "unsupported";
  askNotif: () => Promise<void>;
  missedThisVisit: number;
}

const Ctx = createContext<InboxCtx | null>(null);

function ringOnce(ctx: AudioContext) {
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
}

export function ConsultInboxProvider({ children }: { children: React.ReactNode }) {
  const { me, reload } = usePartner();
  const { toast } = useAdminToast();
  const approved = me?.status === "approved";

  const [requests, setRequests] = useState<SessionView[]>([]);
  const [active, setActive] = useState<SessionView | null>(null);
  const [live, setLive] = useState<InboxCtx["live"]>(null);
  const [waiting, setWaiting] = useState(0);
  const [ready, setReady] = useState(false);
  const [offlineNet, setOfflineNet] = useState(false);
  const [skew, setSkew] = useState(0);
  const [sound, setSound] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");
  const [missedThisVisit, setMissed] = useState(0);

  const audio = useRef<AudioContext | null>(null);
  const known = useRef<Map<string, SessionView>>(new Map());
  const handled = useRef<Set<string>>(new Set());
  const kick = useRef<() => void>(() => undefined);
  const toastRef = useRef(toast);
  const reloadRef = useRef(reload);
  useEffect(() => { toastRef.current = toast; reloadRef.current = reload; }, [toast, reload]);

  // Browser capabilities (client only).
  useEffect(() => {
    const t = setTimeout(() => setNotifPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), 0);
    return () => clearTimeout(t);
  }, []);

  const enableSound = useCallback(async () => {
    try {
      if (!audio.current) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!C) return false;
        audio.current = new C();
      }
      await audio.current.resume();
      setSound(true);
      localStorage.setItem(SOUND_KEY, "1");
      return true;
    } catch { return false; }
  }, []);

  const muteSound = useCallback(() => { setSound(false); localStorage.removeItem(SOUND_KEY); }, []);

  // A saved "sound on" choice needs one user gesture before audio may play.
  useEffect(() => {
    if (localStorage.getItem(SOUND_KEY) !== "1") return;
    const on = () => { void enableSound(); window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
    window.addEventListener("pointerdown", on);
    window.addEventListener("keydown", on);
    return () => { window.removeEventListener("pointerdown", on); window.removeEventListener("keydown", on); };
  }, [enableSound]);

  const askNotif = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    setNotifPerm(await Notification.requestPermission());
  }, []);

  // The long-poll loop.
  useEffect(() => {
    if (!approved) return;
    let alive = true;
    let ctrl: AbortController | null = null;
    let sig: string | null = null;
    let backoff = 2000;
    let first = true;
    let skewMs = 0;
    let wake: (() => void) | null = null;
    // Kick: drop the held poll and ask again at once.
    kick.current = () => { sig = null; ctrl?.abort(); wake?.(); };
    const sleep = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });

    const apply = (reqs: SessionView[], act: SessionView | null, serverNow: string | undefined) => {
      const now = Date.now();
      if (serverNow) { skewMs = Date.parse(serverNow) - now; setSkew(skewMs); }
      const prev = known.current;
      const next = new Map(reqs.map((r) => [r.id, r]));
      // New requests: alert once (not for the ones already waiting when the panel opened).
      const fresh = reqs.filter((r) => !prev.has(r.id));
      if (fresh.length && !first) {
        const r = fresh[0];
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          try { new Notification("New chat request", { body: `${r.customer.name}${r.question ? `: ${r.question.slice(0, 80)}` : ""}`, tag: r.id }); } catch { /* some browsers need a service worker */ }
        }
      }
      // Requests that vanished without our action and had run out of time: missed.
      let missed = 0;
      prev.forEach((r, id) => {
        if (next.has(id) || handled.current.has(id) || act?.id === id) return;
        if (Date.parse(r.expiresAt) - (now + skewMs) <= 3000) missed += 1;
      });
      if (missed) {
        setMissed((m) => m + missed);
        toastRef.current(missed > 1 ? `You missed ${missed} chat requests.` : "You missed a chat request.", "error");
        void reloadRef.current(); // presence may have been switched off after repeated misses
      }
      known.current = next;
      setRequests(reqs);
      setActive(act);
      setReady(true);
    };

    void (async () => {
      while (alive) {
        ctrl = new AbortController();
        const res = await partnerApi.consult.inbox(sig ?? "-", sig !== null, ctrl.signal);
        if (!alive) return;
        if (res.ok) {
          setOfflineNet(false);
          backoff = 2000;
          const serverNow = res.data.requests[0]?.serverNow ?? res.data.active?.serverNow;
          apply(res.data.requests, res.data.active, serverNow);
          setLive(res.data.live ?? null);
          setWaiting(res.data.waiting ?? 0);
          first = false;
          sig = res.data.sig; // "" for an empty inbox; the server waits on it too
          continue;
        }
        if (ctrl.signal.aborted) continue; // kicked: poll again at once
        if (res.status === 403 || res.status === 401) { await sleep(15_000); continue; }
        setOfflineNet(res.status === 0);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 15_000);
      }
    })();

    const onVis = () => { if (document.visibilityState === "visible") kick.current(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; ctrl?.abort(); wake?.(); document.removeEventListener("visibilitychange", onVis); kick.current = () => undefined; };
  }, [approved]);

  // Ring while a request waits.
  useEffect(() => {
    if (!sound || requests.length === 0 || !audio.current) return;
    const ctx = audio.current;
    ringOnce(ctx);
    const t = setInterval(() => ringOnce(ctx), 2500);
    return () => clearInterval(t);
  }, [sound, requests.length]);

  const refresh = useCallback(() => kick.current(), []);
  const forget = useCallback((id: string) => {
    handled.current.add(id);
    setRequests((cur) => cur.filter((r) => r.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ requests, active, live, waiting, ready, offlineNet, skew, refresh, forget, sound, enableSound, muteSound, notifPerm, askNotif, missedThisVisit }}>
      {children}
    </Ctx.Provider>
  );
}

export function useConsultInbox(): InboxCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConsultInbox must be used inside ConsultInboxProvider");
  return c;
}

/** Floating card on other pages: a request is ringing, or a chat is live. */
export function ConsultAlert() {
  const pathname = usePathname();
  const { requests, active } = useConsultInbox();
  if (pathname === "/astrologer/requests" || pathname === "/astrologer/session") return null;
  if (requests.length > 0) {
    const r = requests[0];
    return (
      <Link href="/astrologer/requests" className="fixed bottom-5 right-5 z-40 flex max-w-sm items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-xl"
        style={{ borderColor: "var(--a-gold)", background: "var(--a-surface)" }} role="alert">
        <span className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}><BellRing size={18} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{requests.length > 1 ? `${requests.length} chat requests waiting` : `Chat request from ${r.customer.name}`}</span>
          <span className="block text-xs" style={{ color: "var(--a-muted)" }}>Open to accept or decline</span>
        </span>
      </Link>
    );
  }
  if (active) {
    return (
      <Link href={`/astrologer/session?id=${encodeURIComponent(active.id)}`} className="fixed bottom-5 right-5 z-40 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 shadow-xl"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700"><MessagesSquare size={18} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Live chat with {active.customer.name}</span>
          <span className="block text-xs" style={{ color: "var(--a-muted)" }}>Tap to return to the chat</span>
        </span>
      </Link>
    );
  }
  return null;
}
