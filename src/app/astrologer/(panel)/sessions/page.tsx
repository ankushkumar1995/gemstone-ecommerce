"use client";

/**
 * Sessions history: every chat request this partner received, newest first
 * (GET /astrologer/consult/history). Click a row for the full transcript.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, IndianRupee, MessageCircle, Star } from "lucide-react";
import { AdminSelect, Badge, Card, Drawer, PageHeader, SearchInput, StatCard, StatsSkeleton, useOnMount } from "@/app/admin/_components";
import { partnerApi, type ConsultMessage, type SessionView } from "@/lib/astrologer-api";

const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS: Record<SessionView["status"], { label: string; tone: "green" | "gold" | "muted" | "rose" | "blue" }> = {
  requested: { label: "Waiting", tone: "gold" },
  active: { label: "Live", tone: "green" },
  ended: { label: "Completed", tone: "blue" },
  declined: { label: "Declined", tone: "muted" },
  missed: { label: "Missed", tone: "rose" },
  cancelled: { label: "Withdrawn", tone: "muted" },
};

export default function SessionsHistoryPage() {
  const [rows, setRows] = useState<SessionView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | SessionView["status"]>("all");
  const [open, setOpen] = useState<SessionView | null>(null);
  const [transcript, setTranscript] = useState<ConsultMessage[] | null>(null);

  useOnMount(() => {
    void partnerApi.consult.history().then((r) => { if (r.ok) setRows(r.data.sessions); else setErr(r.message); });
  });

  const list = useMemo(() => (rows ?? []).filter((s) =>
    (status === "all" || s.status === status) &&
    (!q.trim() || `${s.customer.name} ${s.sessionNumber}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, status]);

  const totals = useMemo(() => {
    const done = (rows ?? []).filter((s) => s.status === "ended" && s.minutesCharged > 0);
    const rated = done.filter((s) => s.rating?.status === "approved");
    return {
      chats: done.length,
      minutes: done.reduce((n, s) => n + s.minutesCharged, 0),
      earned: done.reduce((n, s) => n + s.amountPaise, 0),
      rating: rated.length ? (rated.reduce((n, s) => n + (s.rating?.stars ?? 0), 0) / rated.length).toFixed(1) : "-",
    };
  }, [rows]);

  async function show(s: SessionView) {
    setOpen(s);
    setTranscript(null);
    const r = await partnerApi.consult.events(s.id, 0, -1, false);
    setTranscript(r.ok ? r.data.messages : []);
  }

  if (err) return <Card className="py-10 text-center"><p className="text-sm text-rose-700">{err}</p></Card>;
  if (!rows) return <StatsSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Sessions history" subtitle="Your chats, newest first. Earnings are after platform commission." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={MessageCircle} value={totals.chats} label="Completed chats" />
        <StatCard icon={Clock} value={totals.minutes} label="Minutes billed" tone="royal" />
        <StatCard icon={IndianRupee} value={inr(totals.earned)} label="Earned" tone="green" />
        <StatCard icon={Star} value={totals.rating} label="Average rating" />
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search customer or chat number" className="min-w-60 flex-1" />
        <AdminSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status" className="w-44">
          <option value="all">All</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </AdminSelect>
      </div>

      {list.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="font-medium" style={{ color: "var(--a-fg)" }}>{rows.length ? "No chats match" : "No chats yet"}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{rows.length ? "Try another search." : "Go online and accept a request to start."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {list.map((s) => {
              const st = STATUS[s.status];
              return (
                <li key={s.id}>
                  <button onClick={() => void show(s)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{s.customer.name}</p>
                      <p className="text-xs" style={{ color: "var(--a-muted)" }}>{s.sessionNumber} · {when(s.requestedAt)}</p>
                    </div>
                    <span className="text-sm tabular-nums" style={{ color: "var(--a-muted)" }}>{s.minutesCharged} min</span>
                    <span className="w-20 text-right text-sm font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{inr(s.amountPaise)}</span>
                    {s.rating?.status === "approved" && <span className="text-sm" style={{ color: "var(--a-gold)" }}>{s.rating.stars}★</span>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open ? `Chat with ${open.customer.name}` : ""} subtitle={open ? `${open.sessionNumber} · ${when(open.requestedAt)}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg border p-2" style={{ borderColor: "var(--a-border)" }}><p className="text-xs" style={{ color: "var(--a-muted)" }}>Minutes</p><p className="font-semibold">{open.minutesCharged}</p></div>
              <div className="rounded-lg border p-2" style={{ borderColor: "var(--a-border)" }}><p className="text-xs" style={{ color: "var(--a-muted)" }}>Earned</p><p className="font-semibold">{inr(open.amountPaise)}</p></div>
              <div className="rounded-lg border p-2" style={{ borderColor: "var(--a-border)" }}><p className="text-xs" style={{ color: "var(--a-muted)" }}>Rating</p><p className="font-semibold">{open.rating?.status === "approved" ? `${open.rating.stars}/5` : "-"}</p></div>
            </div>
            {open.endText && <p className="text-sm" style={{ color: "var(--a-muted)" }}>{open.endText}</p>}
            {open.rating?.status === "approved" && open.rating.text && <p className="rounded-lg p-3 text-sm" style={{ background: "var(--a-gold-soft)" }}>&ldquo;{open.rating.text}&rdquo;</p>}
            {(open.status === "active" || open.status === "requested") && (
              <Link href={open.status === "active" ? `/astrologer/session?id=${encodeURIComponent(open.id)}` : "/astrologer/requests"} className="text-sm font-medium" style={{ color: "var(--a-gold)" }}>Open this chat</Link>
            )}
            {transcript === null ? <StatsSkeleton count={2} /> : transcript.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--a-faint)" }}>No messages.</p>
            ) : (
              <div className="space-y-2">
                {transcript.map((m) => m.from === "system" ? (
                  <p key={m.seq} className="text-center text-xs" style={{ color: "var(--a-faint)" }}>{m.text}</p>
                ) : (
                  <div key={m.seq} className={`flex ${m.from === "astrologer" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[85%] rounded-xl px-3 py-1.5 text-sm" style={m.from === "astrologer" ? { background: "var(--a-gold-soft)", color: "var(--a-fg)" } : { background: "rgba(0,0,0,0.05)", color: "var(--a-fg)" }}>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="mt-0.5 text-right text-[10px]" style={{ color: "var(--a-faint)" }}>{new Date(m.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
