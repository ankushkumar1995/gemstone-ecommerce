"use client";

/**
 * Help & guidelines (DEMO tickets). Code of conduct (what gets an account
 * suspended is spelled out), FAQs, and support tickets linked to sessions.
 */

import { useState } from "react";
import { CheckCircle2, LifeBuoy, Mail, MessageSquare, ShieldAlert, XCircle } from "lucide-react";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, Field, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, timeAgo } from "../../_components/demo";
import { MOCK_TICKETS } from "../../_components/mock-data";

const DO = [
  "Greet the customer and confirm birth details before the reading.",
  "Give clear, kind answers and a simple remedy the customer can follow.",
  "End a session politely when the question is answered.",
  "Go offline when you take a break.",
  "Report abusive customers with the session id.",
];
const DONT = [
  "Share or ask for phone numbers, WhatsApp, UPI, email or social handles.",
  "Ask customers to pay or meet outside Astrounkle.",
  "Scare customers (death, curses, black magic) to keep them chatting or to sell.",
  "Promise guaranteed results or give medical, legal or financial advice.",
  "Stretch chats with filler to raise the bill.",
  "Ask for tips or gifts, or treat people differently because they tipped.",
];
const STRIKES = [
  { n: "1st strike", what: "Warning in the panel and email" },
  { n: "2nd strike", what: "7-day suspension, earnings for flagged sessions held" },
  { n: "3rd strike", what: "Permanent removal. Fraud cases are refunded to customers from held earnings." },
];
const FAQ = [
  { q: "When do I get paid?", a: "Every Monday for earnings that cleared the 7-day hold. Early payout is available with a 1% fee." },
  { q: "How is the platform fee decided?", a: "It depends on your tier (see Performance). The admin can also set a custom fee for your account, shown on your dashboard." },
  { q: "A customer was abusive. What do I do?", a: "End the session, then raise a dispute from Sessions history. You keep the earning for minutes served unless the session is found to be fraud." },
  { q: "Why was I set offline?", a: "Either 3 requests were missed in a row, or the panel was closed for about a minute. Go online again from the top bar." },
  { q: "Can I change my rate anytime?", a: "Yes, from Profile & rates, within the range the admin allows. New rates apply to new sessions only." },
  { q: "How do tips and live gifts work?", a: "Customers can tip after a session and send gifts during a live. You get 90% of tips and 50% of gifts. Both follow the normal hold period, and a refunded session also refunds its tip." },
  { q: "Who can read my chats?", a: "Only you and the customer. Admins can open a chat only for a complaint or safety review, and every such access is logged with a reason." },
];
const CATEGORIES = ["Payout", "Session or billing", "Customer behaviour", "Technical problem", "KYC", "Other"];

export default function HelpPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [tickets, setTickets] = useState(MOCK_TICKETS);
  const [form, setForm] = useState({ category: CATEGORIES[0], session: "", subject: "", body: "" });

  if (loading || !me) return <StatsSkeleton count={2} />;
  const valid = form.subject.trim().length >= 5 && form.body.trim().length >= 20 && (!form.session || /^ses_\w{2,20}$/.test(form.session.trim()));

  const submit = () => {
    if (!valid) return;
    setTickets((t) => [{ id: `TK-${2300 + t.length}`, subject: form.subject.trim(), status: "open" as const, at: new Date().toISOString(), last: "Thanks. Our team replies within 24 hours." }, ...t]);
    setForm({ category: CATEGORIES[0], session: "", subject: "", body: "" });
    toast("Ticket raised. You get a reply here and by email.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Help & guidelines" subtitle="Rules that keep customers safe and your account in good standing" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Always</p>
          <ul className="space-y-2 text-sm" style={{ color: "var(--a-fg)" }}>{DO.map((d) => <li key={d} className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />{d}</li>)}</ul>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold text-rose-700"><XCircle size={16} /> Never</p>
          <ul className="space-y-2 text-sm" style={{ color: "var(--a-fg)" }}>{DONT.map((d) => <li key={d} className="flex gap-2"><XCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />{d}</li>)}</ul>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><ShieldAlert size={16} /> Strike policy</p>
        <ol className="grid gap-3 md:grid-cols-3">{STRIKES.map((s) => <li key={s.n} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}><p className="font-semibold" style={{ color: "var(--a-fg)" }}>{s.n}</p><p style={{ color: "var(--a-muted)" }}>{s.what}</p></li>)}</ol>
        <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Every strike shows the reason and the session. You can appeal any strike within 7 days through a ticket.</p>
      </Card>

      <Card className="p-5">
        <p className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Common questions</p>
        <div className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {FAQ.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-medium" style={{ color: "var(--a-fg)" }}>{f.q}</summary>
              <p className="mt-2 text-sm" style={{ color: "var(--a-muted)" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </Card>

      <DemoBanner what="Support tickets" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="space-y-4 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><LifeBuoy size={16} /> Raise a ticket</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category"><AdminSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</AdminSelect></Field>
            <Field label="Session id (optional)" hint="e.g. ses_1031"><AdminInput value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value.slice(0, 24) })} /></Field>
          </div>
          <Field label="Subject"><AdminInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value.slice(0, 120) })} /></Field>
          <Field label="What happened?" hint="At least 20 characters"><AdminTextarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value.slice(0, 2000) })} /></Field>
          <AdminButton disabled={!valid} onClick={submit}>Submit ticket</AdminButton>
          <p className="flex items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}><Mail size={13} /> Urgent payout issue? partners@astrounkle.com, 9 am to 9 pm.</p>
        </Card>
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><MessageSquare size={16} /> Your tickets</p>
          <ul className="space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
                <div className="flex items-center justify-between gap-2"><p className="font-medium" style={{ color: "var(--a-fg)" }}>{t.id} · {t.subject}</p><Badge tone={t.status === "open" ? "gold" : "green"}>{t.status}</Badge></div>
                <p className="mt-1" style={{ color: "var(--a-muted)" }}>{t.last}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>{timeAgo(t.at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
