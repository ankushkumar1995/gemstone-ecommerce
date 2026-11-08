"use client";

/**
 * Sessions history (DEMO). Every consultation with filters, totals, and a
 * detail drawer (billing breakdown, who ended it, rating, transcript). A partner
 * can raise a dispute on any session; the admin sees the same record.
 */

import { useMemo, useState } from "react";
import { Download, Flag, MessageCircle, Phone, Video } from "lucide-react";
import { AdminButton, AdminSelect, AdminTextarea, Badge, Card, Drawer, Field, PageHeader, SearchInput, StatCard, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DemoBanner, Stars, fmtDateTime, inr, nowMs } from "../../_components/demo";
import { MOCK_SESSIONS, MOCK_TIPS, MOCK_TRANSCRIPT, TIP_SHARE_PCT, type MockSession } from "../../_components/mock-data";

const PAGE = 12;
const ICON = { chat: MessageCircle, call: Phone, video: Video } as const;
const TONE: Record<MockSession["status"], "green" | "rose" | "muted" | "gold" | "blue"> = { completed: "green", missed: "rose", rejected: "muted", refunded: "gold", cancelled: "muted" };

export default function SessionsHistoryPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | MockSession["status"]>("all");
  const [channel, setChannel] = useState<"all" | MockSession["channel"]>("all");
  const [range, setRange] = useState<"7" | "30" | "all">("30");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<MockSession | null>(null);
  const [dispute, setDispute] = useState("");
  const [disputed, setDisputed] = useState<string[]>([]);

  const rows = useMemo(() => {
    const cutoff = range === "all" ? 0 : nowMs() - Number(range) * 86400000;
    const s = q.trim().toLowerCase();
    return MOCK_SESSIONS.filter((r) =>
      (status === "all" || r.status === status) &&
      (channel === "all" || r.channel === channel) &&
      Date.parse(r.startedAt) >= cutoff &&
      (!s || r.customer.toLowerCase().includes(s) || r.id.includes(s) || r.topic.toLowerCase().includes(s)));
  }, [q, status, channel, range]);

  const totals = useMemo(() => {
    const done = rows.filter((r) => r.status === "completed");
    return { count: done.length, minutes: done.reduce((a, r) => a + r.minutes, 0), net: done.reduce((a, r) => a + r.net, 0), avg: done.length ? done.reduce((a, r) => a + r.minutes, 0) / done.length : 0 };
  }, [rows]);

  if (loading || !me) return <StatsSkeleton count={4} />;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  const exportCsv = () => {
    const head = ["Session", "Date", "Customer", "Channel", "Minutes", "Rate", "Customer paid", "Platform fee", "You earned", "Status", "Rating"];
    const lines = rows.map((r) => [r.id, r.startedAt, r.customer, r.channel, r.minutes, r.rate, r.gross, r.commission, r.net, r.status, r.rating ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sessions.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const submitDispute = () => {
    if (!open || dispute.trim().length < 10) return;
    setDisputed((d) => [...d, open.id]);
    setDispute("");
    toast("Dispute sent. Support replies within 48 hours.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sessions history" subtitle="Every consultation, with billing and transcript" action={<AdminButton variant="outline" onClick={exportCsv}><Download size={15} /> Export CSV</AdminButton>} />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={MessageCircle} value={totals.count} label="Completed" tone="royal" />
        <StatCard icon={Phone} value={totals.minutes} label="Minutes" tone="blue" />
        <StatCard icon={Video} value={totals.avg.toFixed(1)} label="Avg minutes" tone="gold" />
        <StatCard icon={Download} value={inr(Math.round(totals.net))} label="You earned" tone="green" />
      </div>

      <Card className="p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem]">
          <SearchInput value={q} onChange={(v: string) => { setQ(v); setPage(1); }} placeholder="Search customer, topic or session id" />
          <AdminSelect value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} aria-label="Status">
            <option value="all">All status</option><option value="completed">Completed</option><option value="missed">Missed</option><option value="rejected">Rejected</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option>
          </AdminSelect>
          <AdminSelect value={channel} onChange={(e) => { setChannel(e.target.value as typeof channel); setPage(1); }} aria-label="Channel">
            <option value="all">All channels</option><option value="chat">Chat</option><option value="call">Voice call</option><option value="video">Video call</option>
          </AdminSelect>
          <AdminSelect value={range} onChange={(e) => { setRange(e.target.value as typeof range); setPage(1); }} aria-label="Period">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option>
          </AdminSelect>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}>
                <th className="py-2 pr-3 font-medium">When</th><th className="pr-3 font-medium">Customer</th><th className="pr-3 font-medium">Channel</th><th className="pr-3 text-right font-medium">Min</th><th className="pr-3 text-right font-medium">You earned</th><th className="pr-3 font-medium">Rating</th><th className="font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const I = ICON[r.channel];
                return (
                  <tr key={r.id} className="cursor-pointer border-t hover:bg-black/[0.02]" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(r)}>
                    <td className="whitespace-nowrap py-2.5 pr-3 text-xs">{fmtDateTime(r.startedAt)}</td>
                    <td className="pr-3"><span className="font-medium">{r.customer}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{r.topic}</span></td>
                    <td className="pr-3"><span className="flex items-center gap-1.5"><I size={14} />{CHANNEL_LABEL[r.channel]}</span></td>
                    <td className="pr-3 text-right tabular-nums">{r.minutes || "·"}</td>
                    <td className="pr-3 text-right tabular-nums">{r.net ? inr(r.net) : "·"}</td>
                    <td className="pr-3">{r.rating ? <Stars value={r.rating} size={12} /> : <span style={{ color: "var(--a-faint)" }}>·</span>}</td>
                    <td><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={7} className="py-10 text-center" style={{ color: "var(--a-faint)" }}>No sessions match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm" style={{ color: "var(--a-muted)" }}>
          <span>{rows.length} sessions</span>
          <span className="flex items-center gap-2">
            <AdminButton variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</AdminButton>
            {page} / {pages}
            <AdminButton variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</AdminButton>
          </span>
        </div>
      </Card>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${open.customer} · ${open.id}` : ""} subtitle={open ? fmtDateTime(open.startedAt) : undefined}>
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt style={{ color: "var(--a-muted)" }}>Channel</dt><dd className="text-right">{CHANNEL_LABEL[open.channel]} · ₹{open.rate}/min</dd>
              <dt style={{ color: "var(--a-muted)" }}>Billed minutes</dt><dd className="text-right">{open.minutes}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Customer paid</dt><dd className="text-right">{inr(open.gross)}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Platform fee</dt><dd className="text-right">−{inr(open.commission)}</dd>
              <dt className="font-semibold">You earned</dt><dd className="text-right font-semibold text-emerald-700">{inr(open.net)}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Tip</dt><dd className="text-right">{(() => { const t = MOCK_TIPS.find((x) => x.sessionId === open.id); return t ? `${inr(t.amount)} (you get ${inr(Math.round(t.amount * TIP_SHARE_PCT) / 100)})` : "·"; })()}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Ended by</dt><dd className="text-right capitalize">{open.endedBy ?? "·"}</dd>
              <dt style={{ color: "var(--a-muted)" }}>Status</dt><dd className="text-right"><Badge tone={TONE[open.status]}>{open.status}</Badge></dd>
            </dl>
            {open.status === "refunded" && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-800">The admin refunded this session to the customer, so no earning was added.</p>}
            {open.minutes > 0 && open.channel === "chat" && (
              <div>
                <p className="mb-2 font-semibold">Transcript</p>
                <ul className="space-y-2">
                  {MOCK_TRANSCRIPT.map((m, i) => (
                    <li key={i} className={`rounded-lg px-3 py-2 ${m.from === "astrologer" ? "ml-6" : "mr-6"}`} style={{ background: m.from === "astrologer" ? "var(--a-gold-soft)" : "var(--a-surface-2)" }}>
                      <span className="block text-[11px]" style={{ color: "var(--a-muted)" }}>{m.from === "astrologer" ? "You" : open.customer} · {m.at}</span>{m.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {open.channel !== "chat" && open.minutes > 0 && <p style={{ color: "var(--a-muted)" }}>Calls are not recorded. Only the billing record is kept.</p>}
            <div className="border-t pt-4" style={{ borderColor: "var(--a-border)" }}>
              {disputed.includes(open.id) ? (
                <p className="flex items-center gap-2" style={{ color: "var(--a-gold)" }}><Flag size={15} /> Dispute raised. Track it in Help & guidelines.</p>
              ) : (
                <Field label="Something wrong with this session?" hint="e.g. billing looks short, abusive customer, technical drop">
                  <AdminTextarea rows={3} value={dispute} onChange={(e) => setDispute(e.target.value.slice(0, 1000))} placeholder="Describe the problem (at least 10 characters)" />
                  <AdminButton className="mt-2" variant="outline" disabled={dispute.trim().length < 10} onClick={submitDispute}><Flag size={15} /> Raise dispute</AdminButton>
                </Field>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
