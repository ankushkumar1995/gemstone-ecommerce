"use client";

/**
 * Active session (DEMO). Left: chat with typing indicator, sent/delivered/seen
 * ticks, photos, quick replies and automatic contact masking. Right: customer
 * birth details, a real Vedic kundli computed from them, notes from past
 * sessions, and remedy/product suggestions (with the partner's commission).
 * Top: timer, billed minutes, earnings for this session, customer balance.
 *
 * Billing rule shown here matches the live design: chat bills from the
 * partner's first reply, calls from connect (paused while reconnecting), per
 * started minute; chats auto-end when the balance runs out or after 2 minutes
 * of silence. Report & block is available at any time. After the session the
 * partner can send a summary card and start the next customer in the waitlist.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, CheckCheck, Clock, Flag, ImagePlus, IndianRupee, MessageCircle, Phone, PhoneOff, Play, Send, ShieldAlert, Sparkles, Trash2, Users, Video, Wallet, Plus, StickyNote, Gem } from "lucide-react";
import { blockedStore, queueSettingsStore, queueStore, reportsStore, tipsStore, useStore, type QueueEntry, type TipEntry } from "../../_components/demo-store";
import { TIP_SHARE_PCT } from "../../_components/mock-data";
import { ReportModal, REPORT_REASONS, type ReportInput } from "../../_components/session-report";
import { SummaryComposer } from "../../_components/session-summary";
import { CallStage } from "../../_components/call-stage";
import { computeKundli } from "@/lib/astrology/vedic";
import { resolveBirth } from "@/lib/astrology/birth";
import { AdminButton, AdminInput, AdminTextarea, Badge, Card, Modal, StatsSkeleton, Tabs, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DEMO_SESSION_KEY, DemoBanner, inr, maskContacts } from "../../_components/demo";
import { MOCK_PRODUCTS, MOCK_QUICK_REPLIES, MOCK_REQUEST_POOL, MOCK_CUSTOMERS, type MockRequest } from "../../_components/mock-data";

const IDLE_SEC = 120;
const MAX_PHOTO_MB = 5;
const QR_KEY = "astro_demo_quick_replies";
const notesKey = (cid: string) => `astro_demo_notes_${cid}`;

type Status = "sent" | "delivered" | "seen";
type Msg =
  | { id: string; from: "customer" | "astrologer" | "system"; kind: "text"; text: string; at: number; status?: Status; masked?: boolean }
  | { id: string; from: "astrologer"; kind: "photo"; url: string; at: number; status?: Status }
  | { id: string; from: "astrologer"; kind: "product"; product: (typeof MOCK_PRODUCTS)[number]; at: number; status?: Status };
type ActiveSession = MockRequest & { uid: string; startedAt: number };
interface Note { id: string; text: string; at: string }

const CUSTOMER_LINES = [
  "Ji samajh gaya. Aur kuch upay hai?",
  "Kab tak result dikhega?",
  "Thank you ji, ye bahut helpful hai.",
  "Kya ye stone mujhe suit karega?",
  "Ghar mein sab theek rahega na?",
];
const ICON = { chat: MessageCircle, call: Phone, video: Video } as const;
const uid = () => Math.random().toString(36).slice(2, 10);
/** Wall clock, only ever read from event handlers, timers and effects. */
const nowMs = () => Date.now();
const pickLine = () => CUSTOMER_LINES[Math.floor(Math.random() * CUSTOMER_LINES.length)];
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const hhmm = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export default function ActiveSessionPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [ready, setReady] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [now, setNow] = useState(0);
  const [firstReplyAt, setFirstReplyAt] = useState<number | null>(null);
  const [lastActivity, setLastActivity] = useState(0);
  const [violations, setViolations] = useState(0);
  const [quick, setQuick] = useState<string[]>(MOCK_QUICK_REPLIES);
  const [editQuick, setEditQuick] = useState(false);
  const [newQuick, setNewQuick] = useState("");
  const [tab, setTab] = useState<"customer" | "kundli" | "suggest">("customer");
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<null | { reason: string; secs: number; billed: number; gross: number; net: number; refunded: boolean; held: boolean }>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pausedMs, setPausedMs] = useState(0);
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const queue = useStore(queueStore);
  const queueSettings = useStore(queueSettingsStore);
  const [tip, setTip] = useState<TipEntry | null>(null);
  const [thanked, setThanked] = useState(false);
  const tipFor = useRef<string | null>(null);

  // Demo: about half of customers tip a few seconds after a good session.
  // Never for refunded sessions, and only once per session.
  useEffect(() => {
    if (!summary || summary.refunded || !session || summary.billed === 0 || tipFor.current === session.uid) return;
    tipFor.current = session.uid;
    const s = session;
    const t = setTimeout(() => {
      if (Math.random() < 0.5) return;
      const amount = [11, 21, 51, 101][Math.floor(Math.random() * 4)];
      const entry: TipEntry = { id: `tp_${nowMs()}`, customer: s.customer, amount, sessionId: s.uid, note: Math.random() < 0.5 ? "Thank you ji 🙏" : "", at: new Date(nowMs()).toISOString() };
      tipsStore.set((l) => [entry, ...l]);
      setTip(entry);
      setThanked(false);
    }, 3500);
    return () => clearTimeout(t);
  }, [summary, session]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const urls = useRef<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endedRef = useRef(false);

  useEffect(() => () => { timers.current.forEach(clearTimeout); urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, typing]);

  function begin(s: ActiveSession) {
    setSession(s);
    const ts = nowMs();
    setPausedMs(0);
    setPauseStart(null);
    setMsgs([
      { id: uid(), from: "system", kind: "text", text: `Session started · ${CHANNEL_LABEL[s.channel]} at ₹${s.rate}/min. ${s.channel === "chat" ? "Billing starts at your first reply." : "Billing starts when the call connects."}`, at: s.startedAt },
      { id: uid(), from: "customer", kind: "text", text: s.question, at: s.startedAt + 500 },
    ]);
    setLastActivity(ts);
    endedRef.current = false;
    let saved: Note[] | null = null;
    try { const raw = localStorage.getItem(notesKey(s.customerId)); saved = raw ? (JSON.parse(raw) as Note[]) : null; } catch { saved = null; }
    const past = MOCK_CUSTOMERS.find((c) => c.id === s.customerId)?.note;
    setNotes(saved ? saved : past ? [{ id: "past", text: past, at: new Date(ts - 86400000 * 12).toISOString() }] : []);
  }

  function startDemo(channel: ActiveSession["channel"] = "chat", from?: QueueEntry) {
    const r = from ?? MOCK_REQUEST_POOL[0];
    const rate = from ? from.rate : channel === "chat" ? me?.rates.chat || 25 : channel === "call" ? me?.rates.call || 30 : me?.rates.video || 40;
    const s: ActiveSession = { ...MOCK_REQUEST_POOL[0], ...r, channel: from ? from.channel : channel, rate, repeat: false, uid: `${from ? from.id : r.customerId}-${nowMs()}`, startedAt: nowMs() };
    setSummary(null);
    setText("");
    setTab("customer");
    setTip(null);
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(s));
    setFirstReplyAt(null);
    setViolations(0);
    setSummary(null);
    begin(s);
  }

  useOnMount(() => {
    let s: ActiveSession | null = null;
    try { const raw = sessionStorage.getItem(DEMO_SESSION_KEY); s = raw ? (JSON.parse(raw) as ActiveSession) : null; } catch { s = null; }
    const ts = nowMs();
    setNow(ts);
    setLastActivity(ts);
    try { const q = localStorage.getItem(QR_KEY); if (q) setQuick(JSON.parse(q) as string[]); } catch { /* ignore */ }
    if (s) begin(s);
    setReady(true);
  });

  const pct = me?.effectiveCommissionPct ?? 40;
  const isCall = session ? session.channel !== "chat" : false;
  // Billable time: from first reply (chat) or connect (call), minus reconnect pauses.
  const billableMs = firstReplyAt ? Math.max(0, (pauseStart ?? now) - firstReplyAt - pausedMs) : 0;
  const billed = firstReplyAt ? Math.max(1, Math.ceil(billableMs / 60000)) : 0;
  const gross = session ? billed * session.rate : 0;
  const net = Math.round(gross * (100 - pct)) / 100;
  const minutesLeft = session ? session.walletMinutes - billed : 0;
  const idleLeft = IDLE_SEC - Math.floor((now - lastActivity) / 1000);

  function end(reason: string, opts?: { refund?: boolean; hold?: boolean }) {
    if (!session || endedRef.current) return;
    endedRef.current = true;
    timers.current.forEach(clearTimeout);
    setTyping(false);
    setConfirmEnd(false);
    const refund = opts?.refund ?? false;
    setSummary({ reason, secs: Math.floor((nowMs() - session.startedAt) / 1000), billed, gross: refund ? 0 : gross, net: refund ? 0 : net, refunded: refund, held: opts?.hold ?? false });
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  }

  // Stable for CallStage's reconnect effect; reads the latest `end` via ref.
  const endFn = useRef(end);
  useEffect(() => { endFn.current = end; });
  // While paused, billing is frozen at pauseStart, so the dropped time is never billed.
  const failCall = useCallback((reason: string) => { setTimeout(() => endFn.current(reason), 0); }, []);

  function submitReport(r: ReportInput) {
    if (!session) return;
    setReportOpen(false);
    const id = `rp_${nowMs()}`;
    reportsStore.set((l) => [{ id, sessionId: session.uid, customer: session.customer, reason: REPORT_REASONS[r.reason].label, details: r.details, at: new Date(nowMs()).toISOString(), status: "submitted", ended: r.end, blocked: r.block }, ...l]);
    if (r.block) blockedStore.set((l) => (l.some((b) => b.customerId === session.customerId) ? l : [{ customerId: session.customerId, name: session.customer, reason: REPORT_REASONS[r.reason].label, at: new Date(nowMs()).toISOString(), sessionId: session.uid }, ...l]));
    if (r.block) queueStore.set((q) => q.filter((x) => x.customerId !== session.customerId));
    setMsgs((cur) => [...cur, { id: uid(), from: "system", kind: "text", text: r.reason === "selfharm" ? "Safety team alerted. Stay with the customer and share the helpline." : "Report sent to the trust & safety team.", at: nowMs() }]);
    toast(r.block ? `${session.customer} reported and blocked` : "Report sent", "success");
    if (r.end) end(`Ended after a report: ${REPORT_REASONS[r.reason].label}`, { refund: r.reason === "minor", hold: r.reason === "fraud" });
  }

  // 1s tick: timer, low balance and idle auto-end.
  useEffect(() => {
    if (!session || summary) return;
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, [session, summary]);

  const autoEndReason = !session || summary ? null : firstReplyAt && minutesLeft < 0 ? "Customer balance ran out" : !isCall && idleLeft <= 0 ? `No messages for ${IDLE_SEC / 60} minutes` : null;
  useEffect(() => {
    if (!autoEndReason) return;
    const t = setTimeout(() => end(autoEndReason), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEndReason]);

  function later(fn: () => void, ms: number) { timers.current.push(setTimeout(fn, ms)); }

  function pushMine(m: Msg) {
    setMsgs((cur) => [...cur, m]);
    setLastActivity(nowMs());
    if (!firstReplyAt && !isCall) setFirstReplyAt(nowMs());
    later(() => setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, status: "delivered" } : x))), 600);
    later(() => setMsgs((cur) => cur.map((x) => (x.id === m.id ? { ...x, status: "seen" } : x))), 1800);
    // Demo customer reply.
    later(() => setTyping(true), 2400);
    later(() => {
      if (endedRef.current) return;
      setTyping(false);
      setMsgs((cur) => [...cur, { id: uid(), from: "customer", kind: "text", text: pickLine(), at: nowMs() }]);
      setLastActivity(nowMs());
    }, 5200);
  }

  function send(raw: string) {
    const t = raw.trim();
    if (!t || summary) return;
    const clean = maskContacts(t);
    const masked = clean !== t;
    if (masked) {
      setViolations((v) => v + 1);
      toast("Contact details are not allowed. They were hidden and the admin can see this attempt.", "error");
    }
    pushMine({ id: uid(), from: "astrologer", kind: "text", text: clean.slice(0, 2000), at: nowMs(), status: "sent", masked });
    setText("");
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Only images can be shared", "error");
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) return toast(`Max ${MAX_PHOTO_MB} MB per photo`, "error");
    const url = URL.createObjectURL(f);
    urls.current.push(url);
    pushMine({ id: uid(), from: "astrologer", kind: "photo", url, at: nowMs(), status: "sent" });
  }

  function saveQuick(list: string[]) {
    setQuick(list);
    localStorage.setItem(QR_KEY, JSON.stringify(list));
  }

  function addNote() {
    if (!session || noteText.trim().length < 2) return;
    const list = [{ id: uid(), text: noteText.trim().slice(0, 500), at: new Date().toISOString() }, ...notes];
    setNotes(list);
    localStorage.setItem(notesKey(session.customerId), JSON.stringify(list));
    setNoteText("");
    toast("Note saved. Only you can see it.", "success");
  }

  const kundli = useMemo(() => {
    if (!session) return null;
    const b = resolveBirth({ date: session.birth.dob, time: session.birth.time, place: session.birth.place.split(",")[0] });
    if ("error" in b) return { error: b.error };
    return { data: computeKundli({ date: b.utc, latitude: b.latitude, longitude: b.longitude }) };
  }, [session]);

  if (loading || !me || !ready) return <StatsSkeleton count={3} />;

  if (!session) {
    return (
      <div>
        <DemoBanner />
        <Card className="flex flex-col items-center py-16 text-center">
          <MessageCircle size={30} style={{ color: "var(--a-faint)" }} />
          <p className="mt-3 text-lg font-semibold" style={{ color: "var(--a-fg)" }}>No live session</p>
          <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--a-muted)" }}>Accept a request from Live requests and the chat opens here.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/astrologer/requests"><AdminButton>Go to live requests</AdminButton></Link>
            <AdminButton variant="outline" onClick={() => startDemo("chat")}><Sparkles size={15} /> Demo chat</AdminButton>
            <AdminButton variant="outline" onClick={() => startDemo("call")}><Phone size={15} /> Demo voice call</AdminButton>
            <AdminButton variant="outline" onClick={() => startDemo("video")}><Video size={15} /> Demo video call</AdminButton>
          </div>
        </Card>
      </div>
    );
  }

  const Icon = ICON[session.channel];
  const lowBalance = firstReplyAt !== null && minutesLeft <= 1 && !summary;

  if (summary) {
    const next = queueSettings.autoOffer ? queue[0] : undefined;
    return (
      <div className="space-y-4">
        <DemoBanner />
        <Card className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>Session with {session.customer} ended</p>
              <p className="text-sm" style={{ color: "var(--a-muted)" }}>{summary.reason} · {clock(summary.secs * 1000)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt style={{ color: "var(--a-muted)" }}>Billed</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{summary.billed} min</dd>
              <dt style={{ color: "var(--a-muted)" }}>Customer paid</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>{inr(summary.gross)}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Platform fee ({pct}%)</dt><dd className="text-right" style={{ color: "var(--a-fg)" }}>−{inr(Math.round((summary.gross - summary.net) * 100) / 100)}</dd>
              <dt className="font-semibold" style={{ color: "var(--a-fg)" }}>You earned</dt><dd className="text-right font-semibold text-emerald-700">{inr(summary.net)}</dd>
            </dl>
          </div>
          {summary.refunded && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">This session was refunded to the customer (under-18 report). No earning is added.</p>}
          {summary.held && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">Earning for this session is held until the fraud report is reviewed. You are told the result.</p>}
          {!summary.refunded && !summary.held && <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Earnings stay on hold for the dispute window, then move to your payable balance.</p>}
        </Card>

        {tip && (
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-2xl" aria-hidden>🎁</span>
            <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}>
              <b>{session.customer}</b> tipped you {inr(tip.amount)}{tip.note ? `: “${tip.note}”` : ""}. You get {inr(Math.round(tip.amount * TIP_SHARE_PCT) / 100)} ({TIP_SHARE_PCT}%){summary.held ? ", held with this session's review" : ""}.
            </p>
            {thanked ? <Badge tone="green">Thanked</Badge> : <AdminButton variant="outline" onClick={() => { setThanked(true); toast("Thank-you sent", "success"); }}>Say thanks</AdminButton>}
          </Card>
        )}

        {next && (
          <Card className="flex flex-wrap items-center gap-3 p-4 ring-2 ring-[#c9942a]">
            <Users size={18} style={{ color: "var(--a-gold)" }} />
            <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}><b>{next.customer}</b> is next in your waitlist ({CHANNEL_LABEL[next.channel]}, waiting {Math.max(0, Math.floor((now - next.joinedAt) / 60000))} min). {queue.length - 1 > 0 ? `${queue.length - 1} more after them.` : ""}</p>
            <AdminButton onClick={() => { queueStore.set((q) => q.filter((x) => x.id !== next.id)); startDemo(next.channel, next); }}><Play size={15} /> Start with {next.customer}</AdminButton>
            <Link href="/astrologer/waitlist"><AdminButton variant="ghost">Open waitlist</AdminButton></Link>
          </Card>
        )}

        {!summary.refunded && (
          <Card className="p-5">
            <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Send a session summary</p>
            <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Customers who get a summary rate higher and come back more often. It is saved in their app with reminders.</p>
            <SummaryComposer sessionId={session.uid} customer={session.customer} />
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/astrologer/requests"><AdminButton>Back to live requests</AdminButton></Link>
          <AdminButton variant="outline" onClick={() => { setSummary(null); setSession(null); }}>Close</AdminButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DemoBanner />

      {/* top bar */}
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{session.customer}</p>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>{CHANNEL_LABEL[session.channel]} · ₹{session.rate}/min · you keep {100 - pct}%</p>
        </div>
        <Metric icon={Clock} label="Time" value={clock(now - session.startedAt)} />
        <Metric icon={IndianRupee} label="Billed" value={`${billed} min`} />
        <Metric icon={IndianRupee} label="You earn" value={inr(net)} strong />
        <Metric icon={Wallet} label="Customer balance" value={firstReplyAt ? `${Math.max(0, minutesLeft)} min left` : `${session.walletMinutes} min`} danger={lowBalance} />
        <AdminButton variant="outline" onClick={() => setReportOpen(true)}><Flag size={16} /> Report</AdminButton>
        <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}><PhoneOff size={16} /> End</AdminButton>
      </Card>
      {pauseStart !== null && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800" role="status">Call reconnecting. Billing is paused.</p>}

      {lowBalance && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700" role="alert">Customer balance is almost over. The session ends automatically when it runs out. Wrap up your answer.</p>}
      {violations > 0 && <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800" role="alert"><ShieldAlert size={16} /> {violations} contact-sharing attempt{violations > 1 ? "s" : ""} this session. Repeated attempts lead to suspension.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* call stage or chat */}
        {isCall ? (
          <Card className="h-[640px] p-0">
            <CallStage
              key={session.uid}
              video={session.channel === "video"}
              customer={session.customer}
              ended={false}
              onConnected={(at) => setFirstReplyAt((cur) => cur ?? at)}
              onPauseChange={(paused, ms) => {
                if (paused) setPauseStart(nowMs());
                else { setPauseStart(null); setPausedMs((p) => p + (ms ?? 0)); }
              }}
              onFail={failCall}
            />
          </Card>
        ) : (
        <Card className="flex h-[640px] flex-col p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {msgs.map((m) => <Bubble key={m.id} m={m} />)}
            {typing && <div className="flex items-center gap-1 px-1 text-xs" style={{ color: "var(--a-muted)" }}><span className="flex gap-1 rounded-2xl px-3 py-2" style={{ background: "var(--a-surface-2)" }}>{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />)}</span> {session.customer} is typing</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t p-3" style={{ borderColor: "var(--a-border)" }}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {quick.map((q, i) => (
                <span key={`${q}-${i}`} className="flex items-center">
                  <button type="button" disabled={!!summary} onClick={() => (editQuick ? undefined : send(q))} className="max-w-[16rem] truncate rounded-full px-3 py-1 text-xs" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }} title={q}>{q}</button>
                  {editQuick && <button type="button" aria-label="Remove quick reply" onClick={() => saveQuick(quick.filter((_, k) => k !== i))} className="ml-0.5 text-rose-600"><Trash2 size={12} /></button>}
                </span>
              ))}
              <button type="button" onClick={() => setEditQuick((v) => !v)} className="text-xs font-medium" style={{ color: "var(--a-gold)" }}>{editQuick ? "Done" : "Edit quick replies"}</button>
            </div>
            {editQuick && (
              <div className="mb-2 flex gap-2">
                <AdminInput value={newQuick} onChange={(e) => setNewQuick(e.target.value.slice(0, 200))} placeholder="New quick reply" />
                <AdminButton disabled={newQuick.trim().length < 2 || quick.length >= 12} onClick={() => { saveQuick([...quick, newQuick.trim()]); setNewQuick(""); }}><Plus size={15} /></AdminButton>
              </div>
            )}
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} aria-label="Attach photo" />
              <AdminButton type="button" variant="ghost" aria-label="Send a photo" onClick={() => fileRef.current?.click()} disabled={!!summary}><ImagePlus size={18} /></AdminButton>
              <AdminTextarea rows={1} value={text} disabled={!!summary} onChange={(e) => setText(e.target.value.slice(0, 2000))} placeholder={summary ? "Session ended" : "Type your answer"} aria-label="Message"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
              <AdminButton type="submit" disabled={!text.trim() || !!summary} aria-label="Send"><Send size={16} /></AdminButton>
            </form>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--a-faint)" }}>Phone numbers, emails, UPI IDs and links are hidden automatically. Auto-ends after {IDLE_SEC / 60} min of silence ({Math.max(0, idleLeft)}s).</p>
          </div>
        </Card>
        )}

        {/* side panel */}
        <Card className="h-[640px] overflow-y-auto p-0">
          <div className="px-2 pt-1"><Tabs tabs={[{ value: "customer", label: "Customer" }, { value: "kundli", label: "Kundli" }, { value: "suggest", label: "Suggest" }]} value={tab} onChange={setTab} /></div>
          <div className="space-y-4 p-4">
            {tab === "customer" && (
              <>
                <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
                  <dt style={{ color: "var(--a-muted)" }}>Name</dt><dd style={{ color: "var(--a-fg)" }}>{session.customer}</dd>
                  <dt style={{ color: "var(--a-muted)" }}>Born</dt><dd style={{ color: "var(--a-fg)" }}>{new Date(session.birth.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</dd>
                  <dt style={{ color: "var(--a-muted)" }}>Time</dt><dd style={{ color: "var(--a-fg)" }}>{session.birth.time}</dd>
                  <dt style={{ color: "var(--a-muted)" }}>Place</dt><dd style={{ color: "var(--a-fg)" }}>{session.birth.place}</dd>
                  <dt style={{ color: "var(--a-muted)" }}>History</dt><dd style={{ color: "var(--a-fg)" }}>{session.repeat ? "Has consulted you before" : "First session with you"}</dd>
                </dl>
                <p className="text-xs" style={{ color: "var(--a-faint)" }}>Phone and email are never shown to partners.</p>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><StickyNote size={15} /> Your private notes</p>
                  <div className="flex gap-2">
                    <AdminInput value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Shukra remedy given, follow up" onKeyDown={(e) => e.key === "Enter" && addNote()} />
                    <AdminButton onClick={addNote} disabled={noteText.trim().length < 2}><Plus size={15} /></AdminButton>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {notes.length === 0 && <li className="text-xs" style={{ color: "var(--a-faint)" }}>No notes yet.</li>}
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                        {n.text}<span className="mt-0.5 block text-[11px]" style={{ color: "var(--a-muted)" }}>{new Date(n.at).toLocaleDateString("en-IN")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {tab === "kundli" && (kundli && "data" in kundli && kundli.data ? (
              <KundliPanel k={kundli.data} />
            ) : (
              <p className="text-sm" style={{ color: "var(--a-muted)" }}>{kundli && "error" in kundli ? kundli.error : "No birth details."}</p>
            ))}

            {tab === "suggest" && (
              <>
                <p className="text-xs" style={{ color: "var(--a-muted)" }}>Send a product card in chat. You earn the commission shown when the customer buys and keeps it past the return window.</p>
                <ul className="space-y-2">
                  {MOCK_PRODUCTS.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-lg border p-2" style={{ borderColor: "var(--a-border)" }}>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md"><Image src={p.image} alt="" fill sizes="48px" className="object-cover" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "var(--a-muted)" }}>{inr(p.price)} · you earn {inr(Math.round(p.price * p.commissionPct) / 100)} ({p.commissionPct}%)</p>
                      </div>
                      <AdminButton variant="outline" disabled={!!summary} onClick={() => pushMine({ id: uid(), from: "astrologer", kind: "product", product: p, at: nowMs(), status: "sent" })}>Send</AdminButton>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this session?" subtitle="The customer is charged only for the minutes so far." size="sm">
        <div className="grid grid-cols-2 gap-2">
          <AdminButton variant="ghost" onClick={() => setConfirmEnd(false)}>Keep chatting</AdminButton>
          <AdminButton variant="danger" onClick={() => end("Ended by you")}>End session</AdminButton>
        </div>
      </Modal>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} customer={session.customer} onSubmit={submitReport} />
    </div>
  );
}

function Metric({ icon: I, label, value, strong, danger }: { icon: typeof Clock; label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="min-w-[6.5rem]">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide" style={{ color: "var(--a-faint)" }}><I size={11} />{label}</p>
      <p className={`tabular-nums ${strong ? "text-lg font-bold" : "font-semibold"}`} style={{ color: danger ? "#be123c" : strong ? "var(--a-green, #047857)" : "var(--a-fg)" }}>{value}</p>
    </div>
  );
}

function Ticks({ s }: { s?: Status }) {
  if (!s) return null;
  if (s === "sent") return <Check size={13} aria-label="Sent" />;
  return <CheckCheck size={13} aria-label={s === "seen" ? "Seen" : "Delivered"} className={s === "seen" ? "text-sky-500" : ""} />;
}

function Bubble({ m }: { m: Msg }) {
  if (m.from === "system") return <p className="text-center text-xs" style={{ color: "var(--a-faint)" }}>{m.kind === "text" ? m.text : ""}</p>;
  const mine = m.from === "astrologer";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-md bg-gradient-to-br from-[#e6b43a] to-[#c9942a] text-white" : "rounded-bl-md"}`} style={mine ? undefined : { background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
        {m.kind === "text" && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {m.kind === "text" && m.masked && <p className="mt-1 text-[11px] opacity-80">Contact details were hidden</p>}
        {m.kind === "photo" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="Shared photo" className="max-h-60 rounded-lg" />
        )}
        {m.kind === "product" && (
          <div className="w-56 rounded-lg bg-white p-2 text-left" style={{ color: "#18181b" }}>
            <div className="relative h-28 w-full overflow-hidden rounded-md"><Image src={m.product.image} alt="" fill sizes="224px" className="object-cover" /></div>
            <p className="mt-1.5 text-sm font-semibold">{m.product.name}</p>
            <p className="flex items-center gap-1 text-xs text-zinc-600"><Gem size={11} /> For {m.product.planet} · {inr(m.product.price)}</p>
            <span className="mt-1.5 block rounded-md bg-zinc-900 py-1 text-center text-xs font-medium text-white">View in shop</span>
          </div>
        )}
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/80" : ""}`} style={mine ? undefined : { color: "var(--a-faint)" }}>{hhmm(m.at)} {mine && <Ticks s={m.status} />}</p>
      </div>
    </div>
  );
}

function KundliPanel({ k }: { k: ReturnType<typeof computeKundli> }) {
  const asc = k.ascendant.rashiIndex;
  const house = (ri: number) => ((ri - asc + 12) % 12) + 1;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Lagna", `${k.ascendant.rashiSanskrit} (${k.ascendant.rashi})`],
          ["Moon sign", k.moonSign.rashiSanskrit],
          ["Sun sign", k.sunSign.rashiSanskrit],
          ["Nakshatra", `${k.nakshatra.name} · pada ${k.nakshatra.pada}`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg px-3 py-2" style={{ background: "var(--a-surface-2)" }}>
            <p className="text-[11px]" style={{ color: "var(--a-muted)" }}>{l}</p>
            <p className="font-medium" style={{ color: "var(--a-fg)" }}>{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>Nakshatra lord: {k.nakshatra.lord}</p>
      <table className="w-full text-xs">
        <thead><tr style={{ color: "var(--a-muted)" }}><th className="py-1 text-left font-medium">Planet</th><th className="text-left font-medium">Sign</th><th className="text-right font-medium">House</th><th className="text-right font-medium">Deg</th></tr></thead>
        <tbody>
          {k.planets.map((p) => (
            <tr key={p.planet} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
              <td className="py-1.5">{p.planet}{p.retrograde && <Badge tone="rose">R</Badge>}</td>
              <td>{p.rashiSanskrit}</td>
              <td className="text-right">{house(p.rashiIndex)}</td>
              <td className="text-right tabular-nums">{p.degreeInSign.toFixed(1)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Computed from the birth details above (Lahiri ayanamsa, whole-sign houses).</p>
    </div>
  );
}
