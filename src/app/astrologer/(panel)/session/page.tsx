"use client";

/**
 * Live chat (astrologer side).
 *
 * Realtime: a long-poll loop on GET /consult/sessions/:id?after=&v=&wait=1.
 * The server answers at once on a new message, typing, seen, billing tick or
 * end, else after ~20 s. Errors back off (1s doubling to 10s); the loop never
 * throws and stops once the chat is closed.
 *
 * Sending is optimistic and idempotent: each message carries a clientId, so a
 * retry after a network error can never post it twice. Billing starts with the
 * astrologer's first reply; earnings shown are after platform commission.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Ban, Check, CheckCheck, Clock, Flag, IndianRupee, Loader2, MessagesSquare, RotateCw, Send, Sparkles, UserRound, WifiOff } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, ConfirmDialog, Modal, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { partnerApi, type ConsultMessage, type SessionView } from "@/lib/astrologer-api";
import { useConsultInbox } from "../../_components/consult-inbox";
import { RemedyCardBubble, RemedyPicker } from "../../_components/remedy-picker";

const OPEN = new Set(["requested", "active"]);
const TYPING_SHOW_MS = 6000;
const QUICK_REPLIES = [
  "Namaste. I am looking at your chart now.",
  "Please share your exact birth time if you know it.",
  "Give me a minute to check this for you.",
  "Is there anything else you would like to ask?",
];

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(r).padStart(2, "0")}`;
};
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const fmtDob = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
function newClientId() {
  try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
}

type Pending = { clientId: string; text: string; state: "sending" | "failed" };

/* ------------------------------------------------------------------ */

function useChat(id: string) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [messages, setMessages] = useState<ConsultMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<"not_found" | null>(null);
  const [netDown, setNetDown] = useState(false);
  const [skew, setSkew] = useState(0);
  const [typingAt, setTypingAt] = useState(0);
  const kick = useRef<() => void>(() => undefined);

  const merge = useCallback((incoming: ConsultMessage[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const bySeq = new Map(cur.map((m) => [m.seq, m]));
      incoming.forEach((m) => bySeq.set(m.seq, m));
      return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
    });
    const ids = new Set(incoming.map((m) => m.clientId).filter(Boolean));
    if (ids.size) setPending((p) => p.filter((x) => !ids.has(x.clientId)));
  }, []);

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;
    let wake: (() => void) | null = null;
    let after = 0;
    let v = -1;
    let backoff = 1000;
    kick.current = () => { ctrl?.abort(); wake?.(); };
    const sleep = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });

    void (async () => {
      while (alive) {
        ctrl = new AbortController();
        const res = await partnerApi.consult.events(id, after, v, v !== -1, ctrl.signal);
        if (!alive) return;
        if (res.ok) {
          backoff = 1000;
          setNetDown(false);
          const s = res.data.session;
          setSkew(Date.parse(s.serverNow) - Date.now());
          setTypingAt(s.otherTyping ? Date.now() : 0);
          merge(res.data.messages);
          after = Math.max(after, ...res.data.messages.map((m) => m.seq));
          v = s.version;
          setSession(s);
          if (!OPEN.has(s.status)) return; // closed: nothing more will change
          continue;
        }
        if (ctrl.signal.aborted) continue;
        if (res.status === 404 || res.status === 403) { setError("not_found"); return; }
        setNetDown(res.status === 0 || res.status >= 500);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 10_000);
      }
    })();

    const onVis = () => { if (document.visibilityState === "visible") kick.current(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; ctrl?.abort(); wake?.(); document.removeEventListener("visibilitychange", onVis); };
  }, [id, merge]);

  const refresh = useCallback(() => kick.current(), []);
  return { session, setSession, messages, merge, pending, setPending, error, netDown, skew, typingAt, refresh };
}

/* ------------------------------------------------------------------ */

function ChatRoom({ id }: { id: string }) {
  const { toast } = useAdminToast();
  const inbox = useConsultInbox();
  const chat = useChat(id);
  const { session, messages, pending } = chat;
  const [text, setText] = useState("");
  const [now, setNow] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [dialog, setDialog] = useState<null | "report" | "block">(null);
  const [suggesting, setSuggesting] = useState(false);
  const [reason, setReason] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastTyping = useRef(0);
  const lastRead = useRef(0);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  // Keep the newest message in view unless the user scrolled up to read.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  // Seen ticks for the customer: mark what we have read while the tab is visible.
  const lastCustomerSeq = useMemo(() => messages.reduce((m, x) => (x.from === "customer" ? Math.max(m, x.seq) : m), 0), [messages]);
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const send = () => {
      if (document.visibilityState !== "visible" || lastCustomerSeq <= lastRead.current) return;
      lastRead.current = lastCustomerSeq;
      void partnerApi.consult.act(id, "read", { seq: lastCustomerSeq });
    };
    send();
    document.addEventListener("visibilitychange", send);
    return () => document.removeEventListener("visibilitychange", send);
  }, [id, lastCustomerSeq, session]);

  const open = session ? OPEN.has(session.status) : true;
  const active = session?.status === "active";

  const post = useCallback(async (p: Pending) => {
    chat.setPending((cur) => {
      const rest = cur.filter((x) => x.clientId !== p.clientId);
      return [...rest, { ...p, state: "sending" }];
    });
    const res = await partnerApi.consult.act<{ message: ConsultMessage }>(id, "messages", { text: p.text, clientId: p.clientId });
    if (res.ok) {
      chat.merge([res.data.message]);
      chat.refresh();
      return;
    }
    chat.setPending((cur) => cur.map((x) => (x.clientId === p.clientId ? { ...x, state: "failed" } : x)));
    if ((res.details as { reason?: string } | undefined)?.reason === "NOT_ACTIVE") chat.refresh();
    toast(res.message, "error");
  }, [chat, id, toast]);

  function submit() {
    const t = text.trim();
    if (!t || !active) return;
    if (t.length > 2000) return toast("Keep a message under 2000 characters.", "error");
    setText("");
    stick.current = true;
    void post({ clientId: newClientId(), text: t, state: "sending" });
  }

  /** `t` is the event timestamp (ms), used to throttle the typing signal. */
  function onType(v: string, t: number) {
    setText(v);
    if (active && v.trim() && t - lastTyping.current > 3000) {
      lastTyping.current = t;
      void partnerApi.consult.act(id, "typing");
    }
  }

  async function end() {
    setConfirmEnd(false);
    const res = await partnerApi.consult.act(id, "end");
    if (!res.ok) return toast(res.message, "error");
    chat.setSession(res.data.session);
    chat.refresh();
    inbox.refresh();
    toast("Chat ended.", "info");
  }

  async function sendDialog() {
    if (!dialog) return;
    const r = reason.trim();
    if (r.length < 3) return toast("Add a short reason.", "error");
    const res = await partnerApi.consult.act<{ ok: true }>(id, dialog, { reason: r });
    if (!res.ok) return toast(res.message, "error");
    toast(dialog === "block" ? "Customer blocked. They cannot request you again." : "Reported. Our team will review this chat.", "success");
    setDialog(null);
    setReason("");
    chat.refresh();
    inbox.refresh();
  }

  if (chat.error === "not_found") {
    return (
      <Card className="py-12 text-center">
        <p className="font-medium" style={{ color: "var(--a-fg)" }}>Chat not found</p>
        <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>It may belong to another account.</p>
        <Link href="/astrologer/requests" className="mt-4 inline-block text-sm font-medium" style={{ color: "var(--a-gold)" }}>Back to live requests</Link>
      </Card>
    );
  }
  if (!session) return <StatsSkeleton count={3} />;

  const serverNow = (now || Date.parse(session.serverNow) - chat.skew) + chat.skew;
  const startedAt = session.billFrom ? Date.parse(session.billFrom) : null;
  const stopAt = session.endedAt ? Date.parse(session.endedAt) : serverNow;
  const elapsed = startedAt ? (stopAt - startedAt) / 1000 : 0;
  const typing = active && now - chat.typingAt < TYPING_SHOW_MS && chat.typingAt > 0;
  const intake = session.customer.intake;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Chat with ${session.customer.name}`}
        subtitle={`${session.sessionNumber} · ₹${session.rate}/min`}
        action={open ? (
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="ghost" onClick={() => { setReason(""); setDialog("report"); }}><Flag size={15} /> Report</AdminButton>
            <AdminButton variant="outline" onClick={() => { setReason(""); setDialog("block"); }}><Ban size={15} /> Block</AdminButton>
            <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}>End chat</AdminButton>
          </div>
        ) : undefined}
      />

      {chat.netDown && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" role="status"><WifiOff size={16} /> Connection lost. Reconnecting…</div>
      )}

      {!open && <EndedSummary s={session} elapsed={elapsed} />}

      {/* minmax(0,1fr) + min-w-0: the quick-reply strip scrolls inside the card instead of widening the column. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* conversation */}
        <Card className="flex h-[min(70vh,640px)] min-w-0 flex-col p-0">
          <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--a-border)" }}>
            <span className={`h-2.5 w-2.5 rounded-full ${session.otherOnline && open ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
            <p className="flex-1 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
              {typing ? "Customer is typing…" : !open ? "Chat closed" : session.otherOnline ? "Customer is in the chat" : "Customer seems away"}
            </p>
            {active && (
              <span className="flex items-center gap-1.5 text-sm tabular-nums" style={{ color: "var(--a-muted)" }}>
                <Clock size={14} />{session.billing === "waiting_reply" ? "Not started" : clock(elapsed)}
              </span>
            )}
          </div>

          {active && session.billing === "waiting_reply" && (
            <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900" style={{ borderColor: "var(--a-border)" }}>
              <AlertTriangle size={14} /> Billing starts with your first reply. Reply soon, the chat closes if you do not answer.
            </div>
          )}

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
            onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {session.question && (
              <div className="mx-auto max-w-md rounded-lg px-3 py-2 text-center text-xs" style={{ background: "var(--a-gold-soft)", color: "var(--a-fg)" }}>
                Question: {session.question}
              </div>
            )}
            {messages.map((m) => {
              if (m.from === "system") return <p key={m.seq} className="py-1 text-center text-xs" style={{ color: "var(--a-faint)" }}>{m.text}</p>;
              const mine = m.from === "astrologer";
              const seen = mine && session.otherReadSeq >= m.seq;
              if (m.card) {
                return (
                  <div key={m.seq} className="flex flex-col items-end gap-1">
                    <RemedyCardBubble card={m.card} />
                    <p className="flex items-center gap-1 text-[10px]" style={{ color: "var(--a-faint)" }}>{hhmm(m.at)}{seen ? <CheckCheck size={12} aria-label="Seen" /> : <Check size={12} aria-label="Sent" />}</p>
                  </div>
                );
              }
              return (
                <div key={m.seq} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-md text-white" : "rounded-bl-md"}`}
                    style={mine ? { background: "linear-gradient(90deg,#e6b43a,#c9942a)" } : { background: "rgba(0,0,0,0.05)", color: "var(--a-fg)" }}>
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/80" : ""}`} style={mine ? undefined : { color: "var(--a-faint)" }}>
                      {m.masked && <span title="Contact details are hidden for everyone's safety">hidden details ·</span>}
                      {hhmm(m.at)}
                      {mine && (seen ? <CheckCheck size={12} aria-label="Seen" /> : <Check size={12} aria-label="Sent" />)}
                    </p>
                  </div>
                </div>
              );
            })}
            {pending.map((p) => (
              <div key={p.clientId} className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm text-white opacity-80" style={{ background: p.state === "failed" ? "#e11d48" : "linear-gradient(90deg,#e6b43a,#c9942a)" }}>
                  <p className="whitespace-pre-wrap break-words">{p.text}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/90">
                    {p.state === "sending" ? <><Loader2 size={11} className="animate-spin" /> Sending</> : (
                      <>
                        Not sent
                        {active && <button className="ml-1 inline-flex items-center gap-0.5 font-semibold underline" onClick={() => void post(p)}><RotateCw size={11} /> Retry</button>}
                        <button className="ml-1 font-semibold underline" onClick={() => chat.setPending((cur) => cur.filter((x) => x.clientId !== p.clientId))}>Remove</button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
            {typing && <p className="text-xs" style={{ color: "var(--a-muted)" }}>typing…</p>}
          </div>

          {active ? (
            <div className="border-t p-3" style={{ borderColor: "var(--a-border)" }}>
              <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
                {QUICK_REPLIES.map((q) => (
                  <button key={q} onClick={(e) => onType(q, e.timeStamp)} className="shrink-0 rounded-full border px-3 py-1 text-xs hover:bg-black/[0.04]" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>{q}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <AdminTextarea
                  value={text}
                  onChange={(e) => onType(e.target.value, e.timeStamp)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
                  placeholder="Type a reply. Enter sends, Shift+Enter adds a line."
                  rows={2}
                  maxLength={2000}
                  className="flex-1 resize-none"
                  aria-label="Message"
                />
                <div className="flex flex-col gap-1.5">
                  <AdminButton onClick={submit} disabled={!text.trim()} aria-label="Send"><Send size={16} /></AdminButton>
                  <AdminButton variant="outline" onClick={() => setSuggesting(true)} aria-label="Suggest a remedy" title="Suggest a product or pooja"><Sparkles size={16} /></AdminButton>
                </div>
              </div>
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--a-faint)" }}>Phone numbers, emails and links are hidden automatically. Do not ask customers to contact you outside the app.</p>
            </div>
          ) : session.status === "requested" ? (
            <p className="border-t px-4 py-3 text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>Accept the request from <Link href="/astrologer/requests" style={{ color: "var(--a-gold)" }}>Live requests</Link> to start.</p>
          ) : null}
        </Card>

        {/* side panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><UserRound size={15} /> Customer</p>
            <dl className="space-y-2 text-sm">
              <Row k="Name" v={intake?.name || session.customer.name} />
              {intake?.gender && <Row k="Gender" v={intake.gender} />}
              {intake?.dob && <Row k="Date of birth" v={fmtDob(intake.dob)} />}
              {intake?.birthTime && <Row k="Birth time" v={intake.birthTime} />}
              {intake?.birthPlace && <Row k="Birth place" v={intake.birthPlace} />}
            </dl>
            {!intake && <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>The customer has not saved birth details. Ask them in the chat.</p>}
          </Card>
          <Card className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><IndianRupee size={15} /> This chat</p>
            <dl className="space-y-2 text-sm">
              <Row k="Status" v={<Badge tone={active ? "green" : open ? "gold" : "muted"}>{active ? "Live" : session.status}</Badge>} />
              <Row k="Rate" v={`₹${session.rate}/min`} />
              <Row k="Minutes" v={`${session.minutesCharged}${session.freeUsed ? ` (${session.freeUsed} free)` : ""}`} />
              <Row k="Your earning" v={<b>{inr(session.amountPaise)}</b>} />
            </dl>
            <p className="mt-2 text-[11px]" style={{ color: "var(--a-faint)" }}>After platform commission. Each minute is billed when it starts.</p>
          </Card>
        </div>
      </div>

      {active && (
        <RemedyPicker open={suggesting} onClose={() => setSuggesting(false)} sessionId={id} customerName={session.customer.name}
          onSent={(m) => { stick.current = true; chat.merge([m]); chat.refresh(); }} />
      )}

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={() => void end()} danger confirmLabel="End chat"
        title="End this chat?" message="The customer is billed up to the current minute and the chat closes for both of you." />

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialog === "block" ? "Block this customer" : "Report this chat"}
        subtitle={dialog === "block" ? "The chat ends now and they cannot send you requests again." : "Our safety team reviews the full chat."} size="sm">
        <AdminTextarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500} placeholder="What happened?" aria-label="Reason" />
        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" onClick={() => setDialog(null)}>Cancel</AdminButton>
          <AdminButton variant={dialog === "block" ? "danger" : "primary"} onClick={sendDialog} disabled={reason.trim().length < 3}>{dialog === "block" ? "Block and end" : "Send report"}</AdminButton>
        </div>
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: "var(--a-muted)" }}>{k}</dt>
      <dd className="text-right" style={{ color: "var(--a-fg)" }}>{v}</dd>
    </div>
  );
}

function EndedSummary({ s, elapsed }: { s: SessionView; elapsed: number }) {
  const rated = s.rating && s.rating.status === "approved" ? s.rating : null;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <MessagesSquare size={20} style={{ color: "var(--a-gold)" }} />
        <p className="flex-1 font-semibold" style={{ color: "var(--a-fg)" }}>{s.endText ?? "This chat is closed."}</p>
        <Link href="/astrologer/requests"><AdminButton variant="outline">Back to requests</AdminButton></Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat k="Duration" v={s.billFrom ? clock(elapsed) : "0:00"} />
        <Stat k="Minutes billed" v={String(s.minutesCharged)} />
        <Stat k="You earned" v={inr(s.amountPaise)} />
        <Stat k="Rating" v={rated ? `${rated.stars} / 5` : "Not yet"} />
      </div>
    </Card>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--a-border)" }}>
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>{k}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SessionInner() {
  const params = useSearchParams();
  const router = useRouter();
  const inbox = useConsultInbox();
  const id = params.get("id") ?? inbox.active?.id ?? null;

  // Opened without an id while a chat is live: put the id in the URL.
  useEffect(() => {
    if (!params.get("id") && inbox.active) router.replace(`/astrologer/session?id=${encodeURIComponent(inbox.active.id)}`);
  }, [params, inbox.active, router]);

  if (id) return <ChatRoom key={id} id={id} />;
  if (!inbox.ready) return <StatsSkeleton count={3} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Active session" />
      <Card className="flex flex-col items-center py-12 text-center">
        <MessagesSquare size={28} style={{ color: "var(--a-faint)" }} />
        <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>No live chat right now</p>
        <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>Accept a request to start chatting.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/astrologer/requests"><AdminButton>Live requests</AdminButton></Link>
          <Link href="/astrologer/sessions"><AdminButton variant="outline">Sessions history</AdminButton></Link>
        </div>
      </Card>
    </div>
  );
}

export default function SessionPage() {
  return <Suspense fallback={<StatsSkeleton count={3} />}><SessionInner /></Suspense>;
}
