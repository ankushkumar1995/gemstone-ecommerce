"use client";

/**
 * Account health. Everything that affects the partner's standing, in one
 * place and with reasons: warnings, strikes (expire after 90 days), money
 * deductions, reports filed against and by them, and appeals.
 * The account timeline at the bottom is REAL (from the partner's account log;
 * internal admin notes are never included). Strikes / penalties are DEMO data.
 *
 * Appeal rules: one appeal per item, within 7 days of it being issued,
 * 30 to 1000 characters; the decision and reason are shown here.
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, FileWarning, Gavel, HeartPulse, IndianRupee, Scale, ShieldCheck } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, Modal, PageHeader, StatCard, StatsSkeleton, Timeline, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, fmtDateTime, inr, nowMs, timeAgo } from "../../_components/demo";
import { appealsStore, blockedStore, reportsStore, useStore } from "../../_components/demo-store";
import { STATUS_META } from "../../_components/status-meta";

const D = 86400000;
const APPEAL_DAYS = 7;
const STRIKE_DAYS = 90;

interface Item { id: string; kind: "warning" | "strike" | "penalty"; title: string; detail: string; sessionId?: string; issuedAt: number; amount?: number }

function seedItems(t: number): Item[] {
  return [
    { id: "st1", kind: "strike", title: "Shared contact details in chat", detail: "Tried to share a phone number 3 times in one session. Messages were masked.", sessionId: "ses_1012", issuedAt: t - 20 * D },
    { id: "pn1", kind: "penalty", title: "Session refunded after a valid complaint", detail: "Customer was charged for 9 minutes of very short, copy-pasted replies. Earning reversed.", sessionId: "ses_1018", issuedAt: t - 3 * D, amount: 135 },
    { id: "wn1", kind: "warning", title: "Late replies in chat", detail: "Average first reply over 2 minutes in 5 sessions this week. No penalty.", issuedAt: t - 2 * D },
    { id: "wn2", kind: "warning", title: "Set offline after 3 missed requests", detail: "Happened twice this month. Use Break mode when you step away.", issuedAt: t - 9 * D },
  ];
}

const REPORTS_AGAINST = [
  { id: "ra1", reason: "Rude reply", status: "dismissed" as const, note: "Chat reviewed. Your replies were polite.", at: nowMs() - 12 * D },
  { id: "ra2", reason: "Overcharged", status: "under_review" as const, note: "Billing logs are being checked.", at: nowMs() - 1 * D },
];

export default function AccountHealthPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const appeals = useStore(appealsStore);
  const blocked = useStore(blockedStore);
  const myReports = useStore(reportsStore);
  const [now, setNow] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [appealFor, setAppealFor] = useState<Item | null>(null);
  const [text, setText] = useState("");

  useOnMount(() => { const t = nowMs(); setNow(t); setItems(seedItems(t)); });

  if (loading || !me || now === 0) return <StatsSkeleton count={4} />;

  const activeStrikes = items.filter((i) => i.kind === "strike" && now - i.issuedAt < STRIKE_DAYS * D && appeals.find((a) => a.strikeId === i.id)?.status !== "accepted");
  const penalties = items.filter((i) => i.kind === "penalty");
  const deducted = penalties.filter((p) => appeals.find((a) => a.strikeId === p.id)?.status !== "accepted").reduce((a, p) => a + (p.amount ?? 0), 0);
  const blockedStatus = ["suspended", "deactivated", "rejected"].includes(me.status);
  const standing = blockedStatus ? { label: STATUS_META[me.status].label, tone: "rose" as const, help: me.statusReason ?? STATUS_META[me.status].help } :
    activeStrikes.length === 0 ? { label: "Good standing", tone: "green" as const, help: "No active strikes. Keep it up." } :
    activeStrikes.length === 1 ? { label: "1 active strike", tone: "gold" as const, help: "A 2nd strike means a 7-day suspension. Strikes expire after 90 days." } :
    { label: `${activeStrikes.length} active strikes`, tone: "rose" as const, help: "One more strike means permanent removal." };

  const submitAppeal = () => {
    if (!appealFor || text.trim().length < 30) return;
    appealsStore.set((l) => [...l.filter((a) => a.strikeId !== appealFor.id), { strikeId: appealFor.id, text: text.trim(), at: new Date(nowMs()).toISOString(), status: "pending" }]);
    setAppealFor(null);
    setText("");
    toast("Appeal sent. A different reviewer decides within 3 working days.", "success");
  };

  const timeline = me.activity.slice(0, 25).map((a) => ({ title: a.message, time: `${fmtDateTime(a.at)}${a.actor ? ` · ${a.actor}` : ""}`, done: a.type === "created" || a.type === "status" }));

  return (
    <div className="space-y-6">
      <PageHeader title="Account health" subtitle="Your standing, with the reason for every action" />

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className={`flex h-12 w-12 items-center justify-center rounded-full ${standing.tone === "green" ? "bg-emerald-500/15 text-emerald-700" : standing.tone === "gold" ? "bg-amber-500/15 text-amber-700" : "bg-rose-500/15 text-rose-700"}`}><HeartPulse size={22} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>{standing.label}</p>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>{standing.help}</p>
        </div>
        <Link href="/astrologer/help"><AdminButton variant="outline"><Scale size={15} /> Read the strike policy</AdminButton></Link>
      </Card>

      <DemoBanner what="Strikes, warnings, penalties and reports" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Gavel} value={activeStrikes.length} label="Active strikes" tone="rose" />
        <StatCard icon={AlertTriangle} value={items.filter((i) => i.kind === "warning").length} label="Warnings (30 days)" tone="gold" />
        <StatCard icon={IndianRupee} value={inr(deducted)} label="Deducted (30 days)" tone="royal" />
        <StatCard icon={Ban} value={blocked.length} label="Customers you blocked" tone="blue" />
      </div>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Strikes, penalties and warnings</p>
        <ul className="space-y-3">
          {items.map((i) => {
            const appeal = appeals.find((a) => a.strikeId === i.id);
            const canAppeal = i.kind !== "warning" && !appeal && now - i.issuedAt <= APPEAL_DAYS * D;
            const expiresIn = Math.ceil((i.issuedAt + STRIKE_DAYS * D - now) / D);
            return (
              <li key={i.id} className="rounded-lg border p-4" style={{ borderColor: "var(--a-border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={i.kind === "strike" ? "rose" : i.kind === "penalty" ? "royal" : "gold"}>{i.kind}</Badge>
                  <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{i.title}</p>
                  {i.amount !== undefined && <span className="text-sm font-medium text-rose-700">−{inr(i.amount)}</span>}
                  <span className="ml-auto text-xs" style={{ color: "var(--a-muted)" }}>{timeAgo(new Date(i.issuedAt).toISOString())}</span>
                </div>
                <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{i.detail}{i.sessionId && <> · <Link className="underline" href="/astrologer/sessions">{i.sessionId}</Link></>}</p>
                {i.kind === "strike" && <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>{expiresIn > 0 ? `Expires in ${expiresIn} days` : "Expired"}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {appeal && <Badge tone={appeal.status === "accepted" ? "green" : appeal.status === "rejected" ? "rose" : "blue"}>Appeal {appeal.status}</Badge>}
                  {appeal?.decision && <span className="text-xs" style={{ color: "var(--a-muted)" }}>{appeal.decision}</span>}
                  {canAppeal && <AdminButton variant="ghost" onClick={() => setAppealFor(i)}><Scale size={15} /> Appeal</AdminButton>}
                  {i.kind !== "warning" && !appeal && !canAppeal && <span className="text-xs" style={{ color: "var(--a-faint)" }}>Appeal window ({APPEAL_DAYS} days) has closed</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><FileWarning size={16} /> Complaints about you</p>
          <ul className="space-y-2 text-sm">
            {REPORTS_AGAINST.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <span><span style={{ color: "var(--a-fg)" }}>{r.reason}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{r.note}</span></span>
                <Badge tone={r.status === "dismissed" ? "green" : "gold"}>{r.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs" style={{ color: "var(--a-faint)" }}>Customer names are hidden here to prevent retaliation.</p>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><ShieldCheck size={16} /> Reports you filed</p>
          {myReports.length === 0 ? <p className="text-sm" style={{ color: "var(--a-faint)" }}>None. Use Report inside a session if a customer misbehaves.</p> : (
            <ul className="space-y-2 text-sm">
              {myReports.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2">
                  <span><span style={{ color: "var(--a-fg)" }}>{r.customer} · {r.reason}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(r.at)}{r.blocked ? " · blocked" : ""}{r.ended ? " · session ended" : ""}</span></span>
                  <Badge tone="blue">{r.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
          {blocked.length > 0 && <Link href="/astrologer/customers" className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--a-gold)" }}>Manage blocked customers</Link>}
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><CheckCircle2 size={16} /> Account timeline</p>
        {timeline.length ? <Timeline items={timeline} /> : <p className="text-sm" style={{ color: "var(--a-faint)" }}>No activity yet.</p>}
        <p className="mt-3 text-xs" style={{ color: "var(--a-faint)" }}>Every status change, KYC review, profile approval and admin action on your account is listed here with who did it.</p>
      </Card>

      <Modal open={!!appealFor} onClose={() => setAppealFor(null)} title="Appeal this decision" subtitle={appealFor?.title} size="md">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Explain what happened and why you think it is wrong. A reviewer who did not make the first decision checks the session again. You can appeal each item once.</p>
          <AdminTextarea rows={5} value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} aria-label="Appeal" placeholder="At least 30 characters" />
          <p className="text-right text-xs" style={{ color: "var(--a-faint)" }}>{text.length}/1000</p>
          <AdminButton className="w-full" disabled={text.trim().length < 30} onClick={submitAppeal}>Send appeal</AdminButton>
        </div>
      </Modal>
    </div>
  );
}
