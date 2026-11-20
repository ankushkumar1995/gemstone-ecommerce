"use client";

/**
 * Go live (partner panel).
 *
 * Not live: start a live now or schedule one, see scheduled and past lives.
 * Live: the console. A long-poll loop on GET /live/:id brings comments, gifts,
 * joins and the question queue within about a second. The astrologer can
 * reply in the comments, pin / hide / mute, turn comments or questions on and
 * off, set slow mode, answer questions one by one, and end the live.
 *
 * Video is not connected yet (needs a streaming provider and the app build):
 * viewers see the astrologer's photo with the live chat.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ban, BarChart3, CalendarClock, Check, EyeOff, Gift, Heart, IndianRupee, MessageSquare, Mic, MicOff, Pencil, Pin, Radio, Reply, Send, SkipForward, Users, Zap, Video, VideoOff, VolumeX, WifiOff, X } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, ConfirmDialog, Field, Modal, PageHeader, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi, type LiveEvent, type LiveQueueItem, type LiveTemplates, type LiveView } from "@/lib/astrologer-api";
import { LIVE_TAGS } from "@/modules/live/live.types";
import { usePartner } from "../../_components/partner-context";
import { useConsultInbox } from "../../_components/consult-inbox";
import { LiveReportCard } from "../../_components/live-report";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(r).padStart(2, "0")}`;
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const newClientId = () => { try { return crypto.randomUUID().replace(/-/g, ""); } catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; } };
const MAX_EVENTS = 400;

export default function LivePage() {
  const { me, loading } = usePartner();
  const inbox = useConsultInbox();
  const [data, setData] = useState<{ current: LiveView | null; scheduled: LiveView[]; past: LiveView[] } | null>(null);
  const [ended, setEnded] = useState<LiveView | null>(null);

  const load = useCallback(async () => {
    const r = await partnerApi.live.mine();
    if (r.ok) setData(r.data);
  }, []);
  useOnMount(() => { void load(); });

  // The inbox poll notices a live started in another tab.
  const liveId = inbox.live?.id ?? null;
  useEffect(() => {
    if (liveId && data && data.current?.id !== liveId) {
      const t = setTimeout(() => void load(), 0);
      return () => clearTimeout(t);
    }
  }, [liveId, data, load]);

  if (loading || !me || !data) return <StatsSkeleton count={3} />;
  if (me.status !== "approved") {
    return (
      <div className="space-y-6">
        <PageHeader title="Go live" />
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>Lives open after your profile is approved.</p></Card>
      </div>
    );
  }
  if (ended) return <EndedSummary s={ended} onDone={() => { setEnded(null); void load(); }} />;
  if (data.current) return <LiveConsole key={data.current.id} first={data.current} onEnded={(s) => { setEnded(s); inbox.refresh(); }} />;
  return <LiveSetup data={data} reload={load} onLive={() => { void load(); inbox.refresh(); }} />;
}

/* ------------------------------------------------------------------ */

function LiveSetup({ data, reload, onLive }: { data: { scheduled: LiveView[]; past: LiveView[] }; reload: () => Promise<void>; onLive: () => void }) {
  const { toast } = useAdminToast();
  const inbox = useConsultInbox();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [later, setLater] = useState(false);
  const [at, setAt] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  async function submit() {
    if (title.trim().length < 3) return toast("Add a title (at least 3 characters)", "error");
    if (inbox.active) return toast("Finish your live chat before going live.", "error");
    let scheduledAt: string | null = null;
    if (later) {
      const t = Date.parse(at);
      if (!Number.isFinite(t)) return toast("Pick a date and time", "error");
      scheduledAt = new Date(t).toISOString();
    }
    const r = await partnerApi.live.create({ title: title.trim(), topic: topic.trim() || undefined, tags, scheduledAt });
    if (!r.ok) return toast(r.message, "error");
    setTitle(""); setTopic(""); setAt(""); setTags([]);
    if (r.data.live.status === "live") { toast("You are live.", "success"); onLive(); }
    else { toast(`Scheduled for ${when(r.data.live.scheduledAt)}.`, "success"); await reload(); }
  }

  async function act(s: LiveView, action: "start" | "cancel") {
    const r = await partnerApi.live.act(s.id, action);
    if (!r.ok) return toast(r.message, "error");
    if (action === "start") { toast("You are live.", "success"); onLive(); }
    else { toast("Scheduled live cancelled.", "info"); await reload(); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Go live" subtitle="Answer questions for everyone at once. Viewers can comment, ask and send gifts." />
      <Card className="space-y-4 p-5">
        <Field label="Title" hint="Viewers see this on the Live tab">
          <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="For example: Saturn transit, what it means for you" />
        </Field>
        <Field label="Topic (optional)">
          <AdminTextarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} maxLength={200} placeholder="Career, marriage, remedies…" />
        </Field>
        <Field label="Topics (up to 3)" hint="Viewers filter the Live tab by these">
          <div className="flex flex-wrap gap-2">
            {LIVE_TAGS.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on}
                  onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : cur.length >= 3 ? cur : [...cur, t]))}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "var(--a-gold-soft)" : undefined, color: "var(--a-fg)", opacity: !on && tags.length >= 3 ? 0.5 : 1 }}>
                  {t}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={later} onChange={setLater} label="Schedule for later" />
          {later && <AdminInput type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="w-60" aria-label="Start time" />}
        </div>
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>
          Video is not connected yet: viewers see your photo and the live chat, and you answer by typing. Chat requests pause while you are live.
        </p>
        <AdminButton onClick={submit}>{later ? <><CalendarClock size={16} /> Schedule live</> : <><Radio size={16} /> Go live now</>}</AdminButton>
      </Card>

      {data.scheduled.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Scheduled</p>
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {data.scheduled.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{s.title}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>{when(s.scheduledAt)} · {s.stats?.reminderCount ?? 0} reminded</p>
                </div>
                <AdminButton variant="ghost" onClick={() => act(s, "cancel")}>Cancel</AdminButton>
                <AdminButton onClick={() => act(s, "start")}><Radio size={15} /> Start now</AdminButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Past lives</p>
        {data.past.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>Your lives appear here with viewers and gifts.</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {data.past.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium" style={{ color: "var(--a-fg)" }}>{s.title}</p>
                  <p className="text-xs" style={{ color: "var(--a-muted)" }}>{when(s.startedAt)} · {s.startedAt && s.endedAt ? clock((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 1000) : "-"}</p>
                </div>
                <span style={{ color: "var(--a-muted)" }}>{s.stats?.uniqueViewers ?? 0} viewers</span>
                <span style={{ color: "var(--a-muted)" }}>{s.likes} likes</span>
                <span className="font-semibold" style={{ color: "var(--a-fg)" }}>{inr(s.stats?.earningPaise ?? 0)}</span>
                <Link href={`/astrologer/live/${s.id}`}><AdminButton variant="outline"><BarChart3 size={14} /> Report</AdminButton></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function useLiveRoom(first: LiveView) {
  const [live, setLive] = useState<LiveView>(first);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [queue, setQueue] = useState<LiveQueueItem[]>([]);
  const [netDown, setNetDown] = useState(false);
  const [skew, setSkew] = useState(0);
  const kick = useRef<() => void>(() => undefined);

  const merge = useCallback((incoming: LiveEvent[]) => {
    if (!incoming.length) return;
    setEvents((cur) => {
      const m = new Map(cur.map((e) => [e.seq, e]));
      incoming.forEach((e) => m.set(e.seq, e));
      return [...m.values()].sort((a, b) => a.seq - b.seq).slice(-MAX_EVENTS);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    let ctrl: AbortController | null = null;
    let wake: (() => void) | null = null;
    let after = 0, v = -1, backoff = 1000;
    kick.current = () => { ctrl?.abort(); wake?.(); };
    const sleep = (ms: number) => new Promise<void>((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });
    void (async () => {
      while (alive) {
        ctrl = new AbortController();
        const r = await partnerApi.live.events(first.id, after, v, v !== -1, ctrl.signal);
        if (!alive) return;
        if (r.ok) {
          backoff = 1000;
          setNetDown(false);
          setSkew(Date.parse(r.data.live.serverNow) - Date.now());
          merge(r.data.events);
          after = Math.max(after, r.data.live.seq);
          v = r.data.live.version;
          setLive(r.data.live);
          setQueue(r.data.queue ?? []);
          if (r.data.live.status !== "live") return;
          continue;
        }
        if (ctrl.signal.aborted) continue;
        setNetDown(r.status === 0 || r.status >= 500);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 10_000);
      }
    })();
    return () => { alive = false; ctrl?.abort(); wake?.(); };
  }, [first.id, merge]);

  return { live, setLive, events, merge, queue, netDown, skew, refresh: useCallback(() => kick.current(), []) };
}

function LiveConsole({ first, onEnded }: { first: LiveView; onEnded: (s: LiveView) => void }) {
  const { toast } = useAdminToast();
  const room = useLiveRoom(first);
  const { live, events, queue } = room;
  const [now, setNow] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ name: string } | null>(null);
  const [tpl, setTpl] = useState<LiveTemplates | null>(null);
  const [editTpl, setEditTpl] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useOnMount(() => { void partnerApi.liveTools.templates().then((r) => { if (r.ok) setTpl(r.data.templates); }); });
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ seq: number; name: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const f = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(f); clearInterval(t); };
  }, []);
  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [events.length]);

  // The live ended (time limit, disconnect, admin, another tab): show the summary.
  const endedRef = useRef(false);
  useEffect(() => {
    if (live.status !== "live" && !endedRef.current) { endedRef.current = true; onEnded(live); }
  }, [live, onEnded]);

  async function act(action: Parameters<typeof partnerApi.live.act>[1], body?: unknown, okMsg?: string) {
    const r = await partnerApi.live.act(live.id, action, body);
    if (!r.ok) { toast(r.message, "error"); return false; }
    room.setLive(r.data.live);
    room.refresh();
    if (okMsg) toast(okMsg, "success");
    return true;
  }

  /** Post as the astrologer. `pin` = pin it right after (ask-the-viewers prompts). */
  async function post(t: string, opts: { pin?: boolean; restore?: boolean } = {}): Promise<boolean> {
    stick.current = true;
    const r = await partnerApi.live.act<{ event: LiveEvent }>(live.id, "comment", { text: t.slice(0, 300), clientId: newClientId() });
    if (!r.ok) { toast(r.message, "error"); if (opts.restore) setText(t); return false; }
    room.merge([r.data.event]);
    if (opts.pin) await act("pin", { seq: r.data.event.seq });
    room.refresh();
    return true;
  }

  async function send() {
    let t = text.trim();
    if (!t) return;
    if (replyTo && !t.toLowerCase().startsWith(`@${replyTo.name.toLowerCase()}`)) t = `@${replyTo.name} ${t}`;
    setText("");
    if (await post(t, { restore: true })) setReplyTo(null);
  }

  /** Quick reply: {name} becomes the viewer you are replying to, or is dropped. */
  const fill = (tpl: string) => (replyTo ? tpl.replaceAll("{name}", replyTo.name) : tpl.replace(/\s*,?\s*\{name\}/g, "").replace(/\s+([.,!?])/g, "$1")).trim();
  async function quick(tpl: string) {
    if (quickBusy) return;
    setQuickBusy(true);
    const ok = await post(fill(tpl));
    setQuickBusy(false);
    if (ok) setReplyTo(null);
  }
  async function askViewers(tpl: string) {
    if (quickBusy) return;
    setQuickBusy(true);
    const ok = await post(fill(tpl), { pin: true });
    setQuickBusy(false);
    if (ok) toast("Posted and pinned", "success");
  }
  const serverNow = (now || Date.parse(live.serverNow) - room.skew) + room.skew;
  const elapsed = live.startedAt ? (serverNow - Date.parse(live.startedAt)) / 1000 : 0;
  const left = live.endsAt ? (Date.parse(live.endsAt) - serverNow) / 1000 : null;
  const hidden = new Set(live.hiddenSeqs);
  const shown = events.filter((e) => !hidden.has(e.seq));
  const recentJoins = shown.filter((e) => e.kind === "join").slice(-3).map((e) => e.name);
  const feed = shown.filter((e) => e.kind !== "join");
  const answering = live.answering;
  const waiting = queue.filter((q) => q.status === "waiting");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-2.5 py-1 text-xs font-bold tracking-wide text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{live.title}</h1>
        <span className="text-sm tabular-nums" style={{ color: "var(--a-muted)" }}>{clock(elapsed)}{left !== null && left < 15 * 60 ? ` · ends in ${clock(left)}` : ""}</span>
        <AdminButton variant="danger" onClick={() => setConfirmEnd(true)}>End live</AdminButton>
      </div>

      {room.netDown && <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" role="status"><WifiOff size={16} /> Connection lost. Reconnecting… Keep this tab open, the live ends if you are away for 90 seconds.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-7">
        <Stat icon={Users} k="Watching" v={String(live.viewers)} />
        <Stat icon={Users} k="Total viewers" v={String(live.stats?.uniqueViewers ?? 0)} />
        <Stat icon={Heart} k="Likes" v={live.likes.toLocaleString("en-IN")} />
        <Stat icon={Gift} k="Gifts" v={`${live.giftCount} · ${inr(live.stats?.giftsPaise ?? 0)}`} />
        <Stat icon={Mic} k="Super Chats kept" v={`${live.stats?.superChatCount ?? 0} · ${inr(live.stats?.superChatPaise ?? 0)}`} />
        <Stat icon={IndianRupee} k="Your earning" v={inr(live.stats?.earningPaise ?? 0)} />
        <Stat icon={MessageSquare} k="Chat line from live" v={String(live.stats?.chatLeads ?? 0)} />
      </div>

      {/* minmax(0,1fr) + min-w-0: the quick-reply strip scrolls inside the card instead of widening the column. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex h-[min(68vh,620px)] min-w-0 flex-col p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
            <MessageSquare size={15} /><span className="flex-1 font-medium" style={{ color: "var(--a-fg)" }}>Live comments</span>
            {recentJoins.length > 0 && <span className="truncate text-xs" style={{ color: "var(--a-muted)" }}>{recentJoins.join(", ")} joined</span>}
          </div>
          {live.pinned && (
            <div className="flex items-start gap-2 border-b px-4 py-2 text-sm" style={{ borderColor: "var(--a-border)", background: "var(--a-gold-soft)" }}>
              <Pin size={14} className="mt-0.5 shrink-0" />
              <p className="flex-1"><b>{live.pinned.name}:</b> {live.pinned.text}</p>
              <button onClick={() => act("pin", { seq: null })} className="text-xs font-semibold underline" aria-label="Unpin">Unpin</button>
            </div>
          )}
          <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3"
            onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
            {feed.length === 0 && <p className="py-10 text-center text-sm" style={{ color: "var(--a-faint)" }}>Comments from viewers appear here.</p>}
            {feed.map((e) => e.kind === "system" ? (
              <p key={e.seq} className="py-1 text-center text-xs" style={{ color: "var(--a-faint)" }}>{e.text}</p>
            ) : e.kind === "superchat" ? (
              <div key={e.seq} className="rounded-lg border-2 px-3 py-2 text-sm" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-gold)" }}>Super Chat · it is at the top of your questions</p>
                <p><b>{e.name}:</b> {e.text}</p>
              </div>
            ) : e.kind === "gift" ? (
              <div key={e.seq} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm" style={{ background: "var(--a-gold-soft)" }}>
                <span className="text-lg">{e.gift?.emoji}</span>
                <p className="flex-1"><b>{e.name}</b> sent {e.gift?.name}{(e.gift?.count ?? 1) > 1 ? ` ×${e.gift?.count}` : ""} · ₹{(e.gift?.price ?? 0) * (e.gift?.count ?? 1)}</p>
              </div>
            ) : (
              <div key={e.seq} className="group flex items-start gap-2 rounded-lg px-2 py-1 hover:bg-black/[0.03]">
                <p className="flex-1 break-words text-sm" style={{ color: "var(--a-fg)" }}>
                  <b style={{ color: e.by === "astrologer" ? "var(--a-gold)" : "var(--a-fg)" }}>{e.by === "astrologer" ? "You" : e.name}</b> {e.text}
                </p>
                {e.by === "customer" && (
                  <span className="flex shrink-0 gap-1 opacity-60 group-hover:opacity-100">
                    <IconBtn label="Reply" onClick={() => { setReplyTo({ name: e.name }); inputRef.current?.focus(); }}><Reply size={13} /></IconBtn>
                    <IconBtn label="Pin" onClick={() => act("pin", { seq: e.seq })}><Pin size={13} /></IconBtn>
                    <IconBtn label="Hide" onClick={() => act("hide", { seq: e.seq }, "Comment hidden")}><EyeOff size={13} /></IconBtn>
                    <IconBtn label="Mute this viewer" onClick={() => act("mute", { seq: e.seq }, `${e.name} muted for this live`)}><VolumeX size={13} /></IconBtn>
                    <IconBtn label="Block for good" onClick={() => setBlockTarget({ seq: e.seq, name: e.name })}><Ban size={13} /></IconBtn>
                  </span>
                )}
              </div>
            ))}
          </div>
          {(tpl?.quickReplies.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-t px-3 pt-2" style={{ borderColor: "var(--a-border)" }} aria-label="Quick replies">
              <Zap size={13} className="shrink-0" style={{ color: "var(--a-gold)" }} />
              {tpl!.quickReplies.map((q) => (
                <button key={q} type="button" disabled={quickBusy} onClick={() => void quick(q)} title={`Send: ${fill(q)}`}
                  className="max-w-[220px] shrink-0 truncate rounded-full border px-2.5 py-1 text-xs hover:bg-black/[0.04] disabled:opacity-50" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  {fill(q)}
                </button>
              ))}
              <button type="button" onClick={() => setEditTpl(true)} className="shrink-0 rounded p-1 hover:bg-black/[0.06]" title="Edit quick replies" aria-label="Edit quick replies" style={{ color: "var(--a-muted)" }}><Pencil size={13} /></button>
            </div>
          )}
          {replyTo && (
            <div className="flex items-center gap-2 px-3 pt-2 text-xs" style={{ color: "var(--a-muted)" }}>
              <Reply size={12} /> Replying to <b style={{ color: "var(--a-fg)" }}>{replyTo.name}</b>. Quick replies use their name.
              <button type="button" onClick={() => setReplyTo(null)} className="underline">Cancel</button>
            </div>
          )}
          <div className="flex items-end gap-2 p-3">
            <AdminTextarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} className="flex-1 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              placeholder="Reply to everyone. Enter sends." aria-label="Your comment" />
            <AdminButton onClick={send} disabled={!text.trim()} aria-label="Send"><Send size={16} /></AdminButton>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><Mic size={15} /> Questions <Badge tone={waiting.length ? "gold" : "muted"}>{waiting.length} waiting</Badge></p>
            {answering && (
              <div className="mb-3 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-gold)" }}>Now answering</p>
                <p className="mt-1">{(answering.paidPaise ?? 0) > 0 && <Badge tone="gold">Super Chat ₹{(answering.paidPaise ?? 0) / 100}</Badge>} <b>{answering.name}:</b> {answering.question}</p>
                <AdminButton className="mt-2" onClick={() => act("done", { queueId: answering.queueId })}><Check size={15} /> Done</AdminButton>
              </div>
            )}
            <p className="mb-2 text-[11px]" style={{ color: "var(--a-faint)" }}>Super Chats come first. Answer and press Done to keep it; Skip gives the money back to the viewer.</p>
            {waiting.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>{live.queueOpen ? "Viewers can ask from the app. Their questions line up here." : "Questions are closed."}</p> : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {waiting.map((q, i) => (
                  <li key={q.id} className="rounded-lg border p-2.5 text-sm" style={{ borderColor: q.paidPaise > 0 ? "var(--a-gold)" : "var(--a-border)", background: q.paidPaise > 0 ? "var(--a-gold-soft)" : undefined }}>
                    <p><span className="text-xs" style={{ color: "var(--a-muted)" }}>#{i + 1}</span> {q.paidPaise > 0 && <Badge tone="gold">Super Chat ₹{q.paidPaise / 100}</Badge>} <b>{q.name}:</b> {q.question}</p>
                    <div className="mt-2 flex gap-2">
                      <AdminButton onClick={() => act("answer", { queueId: q.id })}>Answer</AdminButton>
                      <AdminButton variant="ghost" onClick={() => act("skip", { queueId: q.id })}><SkipForward size={14} /> Skip</AdminButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-2 p-4">
            <p className="flex items-center justify-between text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
              <span className="flex items-center gap-2"><MessageSquare size={15} /> Ask your viewers</span>
              <button type="button" onClick={() => setEditTpl(true)} className="rounded p-1 text-xs font-medium hover:bg-black/[0.06]" style={{ color: "var(--a-muted)" }}><Pencil size={13} className="mr-1 inline" />Edit</button>
            </p>
            <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>One tap posts it and pins it on top, so viewers start talking.</p>
            {!tpl ? <p className="text-xs" style={{ color: "var(--a-faint)" }}>Loading…</p> : tpl.askTemplates.length === 0 ? <p className="text-xs" style={{ color: "var(--a-faint)" }}>No templates. Add some with Edit.</p> : (
              <ul className="space-y-1.5">
                {tpl.askTemplates.map((q) => (
                  <li key={q}>
                    <button type="button" disabled={quickBusy} onClick={() => void askViewers(q)}
                      className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-black/[0.03] disabled:opacity-50" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Controls</p>
            <Toggle checked={!live.commentsOff} onChange={(v) => void act("settings", { commentsOff: !v })} label="Viewer comments" />
            <Toggle checked={live.queueOpen} onChange={(v) => void act("settings", { queueOpen: v })} label="Accept questions" />
            <Field label="Slow mode">
              <AdminSelect value={String(live.slowSec)} onChange={(e) => void act("settings", { slowSec: Number(e.target.value) })} aria-label="Slow mode">
                {[0, 3, 5, 10, 30, 60].map((s) => <option key={s} value={s}>{s ? `One comment every ${s} s` : "Off"}</option>)}
              </AdminSelect>
            </Field>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Phone numbers, emails and links are hidden automatically. Abusive comments and copy-paste spam are hidden by themselves. Muted viewers cannot comment or ask on this live. Blocked viewers cannot comment, ask, gift or chat with you again, on any live.</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Viewers can join your 1-to-1 chat line from the live. The first one gets their turn when you end the live. <Link href="/astrologer/blocked" className="font-semibold underline">Blocked people</Link></p>
          </Card>

          <CameraCard live={live} onLive={(l) => { room.setLive(l); room.refresh(); }} />
        </div>
      </div>

      {tpl && editTpl && <TemplatesEditor open value={tpl} onClose={() => setEditTpl(false)} onSaved={(v) => { setTpl(v); setEditTpl(false); }} />}
      <ConfirmDialog open={!!blockTarget} onClose={() => setBlockTarget(null)} danger confirmLabel="Block" title={`Block ${blockTarget?.name ?? "this viewer"}?`}
        message="They cannot comment, ask, send gifts or chat with you again, on this live and every future one. Their waiting question is removed and any Super Chat is refunded. You can unblock them later from Blocked people."
        onConfirm={async () => {
          const b = blockTarget;
          setBlockTarget(null);
          if (b) await act("block", { seq: b.seq }, `${b.name} blocked`);
        }} />
      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} danger confirmLabel="End live" title="End this live?"
        message="Viewers see that the live has ended. Waiting questions are closed. The first person in your chat line gets their turn."
        onConfirm={async () => {
          setConfirmEnd(false);
          const r = await partnerApi.live.act(live.id, "end");
          if (!r.ok) return toast(r.message, "error");
          room.setLive(r.data.live);
        }} />
    </div>
  );
}

/**
 * Camera: publishes the browser camera + mic to LiveKit, then asks the server to
 * start the HLS feed that the app plays. Viewers see it a few seconds behind.
 * Closing the tab or ending the live stops it; LiveKit also stops when the room empties.
 */
type LkRoom = import("livekit-client").Room;

function CameraCard({ live, onLive }: { live: LiveView; onLive: (l: LiveView) => void }) {
  const { toast } = useAdminToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<LkRoom | null>(null);
  const [state, setState] = useState<"off" | "connecting" | "on">("off");
  const [mic, setMic] = useState(true);

  // Leave the room when the console unmounts (tab closed, live ended).
  useEffect(() => () => { void roomRef.current?.disconnect(); roomRef.current = null; }, []);

  async function start() {
    if (state !== "off") return;
    setState("connecting");
    try {
      const t = await partnerApi.live.act<{ url: string; token: string }>(live.id, "video-token");
      if (!t.ok) { toast(t.message, "error"); setState("off"); return; }
      const { Room, RoomEvent, Track, VideoPresets } = await import("livekit-client");
      const room = new Room({ adaptiveStream: false, dynacast: false, videoCaptureDefaults: { resolution: VideoPresets.h720.resolution } });
      room.on(RoomEvent.Disconnected, () => { roomRef.current = null; setState("off"); });
      await room.connect(t.data.url, t.data.token);
      roomRef.current = room;
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      const cam = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      if (cam && videoRef.current) cam.attach(videoRef.current);
      const on = await partnerApi.live.act(live.id, "video-on");
      if (!on.ok) { toast(on.message, "error"); await room.disconnect(); setState("off"); return; }
      onLive(on.data.live);
      setMic(true);
      setState("on");
      toast("Camera is on. Viewers see you in a few seconds.", "success");
    } catch (e) {
      const msg = e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "Allow camera and microphone in the browser, then try again." : "Could not start the camera. Check it is not used by another app.";
      toast(msg, "error");
      await roomRef.current?.disconnect();
      roomRef.current = null;
      setState("off");
    }
  }

  async function stop() {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setState("off");
    const r = await partnerApi.live.act(live.id, "video-off");
    if (r.ok) onLive(r.data.live);
  }

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!mic);
    setMic(!mic);
  }

  if (!live.videoAvailable) {
    return (
      <Card className="p-4">
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>
          Live video is not set up on the server yet, so viewers see your photo with this chat. Keep this tab open: if the panel is closed for 90 seconds the live ends by itself.
        </p>
      </Card>
    );
  }
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><Video size={15} /> Camera
        {state === "on" && <Badge tone="rose">On air</Badge>}
        {state === "off" && live.stream && <Badge tone="gold">Video on in another tab</Badge>}
      </p>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        {state !== "on" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-white/80">
            {state === "connecting" ? "Starting camera…" : "Camera is off. Viewers see your photo."}
          </div>
        )}
      </div>
      {state === "on" ? (
        <div className="flex gap-2">
          <AdminButton variant="outline" onClick={toggleMic}>{mic ? <><Mic size={15} /> Mute mic</> : <><MicOff size={15} /> Unmute</>}</AdminButton>
          <AdminButton variant="danger" onClick={stop}><VideoOff size={15} /> Camera off</AdminButton>
        </div>
      ) : (
        <AdminButton onClick={start} loading={state === "connecting"}><Video size={15} /> Turn on camera</AdminButton>
      )}
      <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Viewers see and hear you about 5 to 10 seconds late, so give them a moment to react. Keep this tab open while live.</p>
    </Card>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} title={label} aria-label={label} className="rounded p-1 hover:bg-black/[0.06]" style={{ color: "var(--a-muted)" }}>{children}</button>;
}

function Stat({ icon: Icon, k, v }: { icon: typeof Users; k: string; v: string }) {
  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><Icon size={13} /> {k}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
    </Card>
  );
}

function EndedSummary({ s, onDone }: { s: LiveView; onDone: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Live ended" subtitle={s.endText ?? "Here is how your live did."}
        action={<div className="flex gap-2">
          <Link href="/astrologer/requests"><AdminButton variant="outline">Chat requests</AdminButton></Link>
          <AdminButton onClick={onDone}><X size={15} /> Close</AdminButton>
        </div>} />
      <LiveReportCard liveId={s.id} />
    </div>
  );
}

/** Edit quick replies and ask templates. One per line; up to 12 each. Saved to the account, so they show on every device. */
function TemplatesEditor({ open, value, onClose, onSaved }: { open: boolean; value: LiveTemplates; onClose: () => void; onSaved: (v: LiveTemplates) => void }) {
  const { toast } = useAdminToast();
  const [qr, setQr] = useState(() => value.quickReplies.join("\n"));
  const [at, setAt] = useState(() => value.askTemplates.join("\n"));
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter((x) => x.length >= 2);
  const tooMany = lines(qr).length > 12 || lines(at).length > 12;
  const tooLong = [...lines(qr), ...lines(at)].some((x) => x.length > 200);

  async function save(data: { quickReplies?: string[] | null; askTemplates?: string[] | null }, msg: string) {
    setBusy(true);
    const r = await partnerApi.liveTools.saveTemplates(data);
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setQr(r.data.templates.quickReplies.join("\n"));
    setAt(r.data.templates.askTemplates.join("\n"));
    toast(msg, "success");
    onSaved(r.data.templates);
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick replies and templates" subtitle="One per line. Up to 12 each, 200 characters each." size="lg">
      <div className="space-y-4">
        <Field label="Quick replies" hint={`${lines(qr).length}/12 · one tap sends it · {name} = the viewer you reply to${value.custom.quickReplies ? "" : " · showing the default list"}`}>
          <AdminTextarea value={qr} onChange={(e) => setQr(e.target.value)} rows={6} maxLength={4000} aria-label="Quick replies" />
        </Field>
        <Field label="Ask your viewers" hint={`${lines(at).length}/12 · one tap posts and pins it${value.custom.askTemplates ? "" : " · showing the default list"}`}>
          <AdminTextarea value={at} onChange={(e) => setAt(e.target.value)} rows={5} maxLength={4000} aria-label="Ask templates" />
        </Field>
        {(tooMany || tooLong) && <p className="text-xs text-rose-600">{tooMany ? "Keep up to 12 lines in each list." : "Keep each line under 200 characters."}</p>}
        <p className="text-xs" style={{ color: "var(--a-muted)" }}>Phone numbers, emails and links are hidden automatically, same as comments.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <AdminButton variant="ghost" disabled={busy} onClick={() => save({ quickReplies: null, askTemplates: null }, "Back to the default lists")}>Use defaults</AdminButton>
          <AdminButton variant="outline" onClick={onClose}>Cancel</AdminButton>
          <AdminButton loading={busy} disabled={tooMany || tooLong} onClick={() => save({ quickReplies: lines(qr), askTemplates: lines(at) }, "Saved")}>Save</AdminButton>
        </div>
      </div>
    </Modal>
  );
}
