"use client";

/**
 * Free follow-ups (DEMO). After a paid session the customer may ask ONE short
 * free question within the follow-up window. You reply once within 24 hours.
 *   • replies are final (one question, one answer), 10 to 500 characters,
 *     contact details masked
 *   • unanswered by the deadline → expired, counts against your response rate
 *   • a question that is really a new reading can be answered with
 *     "Needs a paid session" (polite note + book button for the customer),
 *     which does not count against you
 *   • blocked customers cannot send follow-ups
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, MessageSquareReply, TimerOff, Ticket } from "lucide-react";
import { AdminButton, AdminSelect, AdminTextarea, Badge, Card, Field, Modal, PageHeader, StatCard, StatsSkeleton, Tabs, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, maskContacts, nowMs, timeAgo } from "../../_components/demo";
import { blockedStore, followUpSettingsStore, followUpsStore, useStore, type FollowUp } from "../../_components/demo-store";

const H = 3600_000;
const PAID_NOTE = "Ye sawal ek nayi reading maangta hai. Aap mujhse ek session book karein, main detail mein dekh lunga. Dhanyavaad.";

function seed(): FollowUp[] {
  const t = nowMs();
  return [
    { id: "fu1", sessionId: "ses_1039", customer: "Riya S.", question: "Aapne Friday ko safed daan bataya tha. Kya chawal de sakti hoon?", askedAt: t - 2 * H, replyBy: t + 22 * H, status: "pending" },
    { id: "fu2", sessionId: "ses_1036", customer: "Amit V.", question: "Mantra subah bolna hai ya shaam ko bhi chalega?", askedAt: t - 23 * H, replyBy: t + 1 * H, status: "pending" },
    { id: "fu3", sessionId: "ses_1033", customer: "Neha G.", question: "Ab mere bhai ki kundli bhi dekh lijiye, uska DOB 4 May 1995 hai.", askedAt: t - 5 * H, replyBy: t + 19 * H, status: "pending" },
    { id: "fu4", sessionId: "ses_1030", customer: "Sneha I.", question: "Opal silver mein pehnu ya gold mein?", askedAt: t - 30 * H, replyBy: t - 6 * H, reply: "Silver mein, right hand ki ring finger mein, Friday subah.", repliedAt: t - 28 * H, status: "replied" },
    { id: "fu5", sessionId: "ses_1027", customer: "Vikas J.", question: "Kitne din mein fark dikhega?", askedAt: t - 50 * H, replyBy: t - 26 * H, status: "pending" },
  ];
}

export default function FollowUpsPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const stored = useStore(followUpsStore);
  const settings = useStore(followUpSettingsStore);
  const blocked = useStore(blockedStore);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<"pending" | "done" | "expired">("pending");
  const [replyFor, setReplyFor] = useState<FollowUp | null>(null);
  const [reply, setReply] = useState("");
  const [confirm, setConfirm] = useState(false);

  useOnMount(() => { setNow(nowMs()); if (followUpsStore.get() === null) followUpsStore.set(seed()); });
  useEffect(() => { const id = setInterval(() => setNow(nowMs()), 60_000); return () => clearInterval(id); }, []);

  if (loading || !me || stored === null || now === 0) return <StatsSkeleton count={3} />;

  const blockedIds = new Set(blocked.map((b) => b.name));
  const items = stored
    .filter((f) => !blockedIds.has(f.customer))
    .map((f) => (f.status === "pending" && f.replyBy <= now ? { ...f, status: "expired" as const } : f));
  const pending = items.filter((f) => f.status === "pending").sort((a, b) => a.replyBy - b.replyBy);
  const done = items.filter((f) => f.status === "replied" || f.status === "flagged");
  const expired = items.filter((f) => f.status === "expired");
  const answeredOnTime = items.filter((f) => f.status === "replied").length;
  const rate = answeredOnTime + expired.length ? Math.round((answeredOnTime / (answeredOnTime + expired.length)) * 100) : 100;
  const shown = tab === "pending" ? pending : tab === "done" ? done : expired;

  const finish = (f: FollowUp, text: string, status: "replied" | "flagged") => {
    followUpsStore.set((list) => (list ?? []).map((x) => (x.id === f.id ? { ...x, reply: text, repliedAt: nowMs(), status } : x)));
    setReplyFor(null);
    setReply("");
    setConfirm(false);
    toast(status === "replied" ? `Reply sent to ${f.customer}` : `${f.customer} was asked to book a session`, "success");
  };

  const clean = maskContacts(reply.trim());
  const valid = clean.length >= 10 && clean.length <= 500;

  return (
    <div className="space-y-6">
      <PageHeader title="Free follow-ups" subtitle="One free question per paid session. Reply within 24 hours." />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Clock} value={pending.length} label="Waiting for you" tone="gold" />
        <StatCard icon={CheckCircle2} value={answeredOnTime} label="Answered" tone="green" />
        <StatCard icon={TimerOff} value={expired.length} label="Missed" tone="rose" />
        <StatCard icon={Ticket} value={`${rate}%`} label="Follow-up response rate" tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-0">
          <div className="px-2"><Tabs tabs={[{ value: "pending", label: "Waiting", count: pending.length }, { value: "done", label: "Answered" }, { value: "expired", label: "Missed", count: expired.length }]} value={tab} onChange={setTab} /></div>
          <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
            {shown.length === 0 && <li className="py-12 text-center text-sm" style={{ color: "var(--a-faint)" }}>Nothing here.</li>}
            {shown.map((f) => {
              const hoursLeft = Math.max(0, Math.round((f.replyBy - now) / H));
              return (
                <li key={f.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{f.customer}</p>
                    <span className="text-xs" style={{ color: "var(--a-muted)" }}>after {f.sessionId} · asked {timeAgo(new Date(f.askedAt).toISOString())}</span>
                    {f.status === "pending" && <Badge tone={hoursLeft <= 2 ? "rose" : "gold"}>{hoursLeft <= 1 ? "Under 1 hour left" : `${hoursLeft} h left`}</Badge>}
                    {f.status === "flagged" && <Badge tone="blue">Asked to book a session</Badge>}
                    {f.status === "expired" && <Badge tone="rose">Missed</Badge>}
                  </div>
                  <p className="text-sm" style={{ color: "var(--a-fg)" }}>&ldquo;{f.question}&rdquo;</p>
                  {f.reply && <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}><span className="block text-[11px] font-semibold" style={{ color: "var(--a-gold)" }}>Your reply</span>{f.reply}</p>}
                  {f.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <AdminButton onClick={() => { setReplyFor(f); setReply(""); }}><MessageSquareReply size={15} /> Reply</AdminButton>
                      <AdminButton variant="ghost" onClick={() => finish(f, PAID_NOTE, "flagged")}>Needs a paid session</AdminButton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Follow-up settings</p>
          <Toggle checked={settings.offer} onChange={(v) => followUpSettingsStore.set({ ...settings, offer: v })} label="Offer a free follow-up after paid sessions" />
          <Field label="Customer can ask within" hint="Counted from the end of the session">
            <AdminSelect value={settings.windowHours} onChange={(e) => followUpSettingsStore.set({ ...settings, windowHours: Number(e.target.value) as 24 | 48 | 72 })} disabled={!settings.offer}>
              <option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option>
            </AdminSelect>
          </Field>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Partners who offer follow-ups get about 20% more repeat customers. Turning this off does not affect questions already asked.</p>
        </Card>
      </div>

      <Modal open={!!replyFor} onClose={() => setReplyFor(null)} title={replyFor ? `Reply to ${replyFor.customer}` : ""} subtitle="You can reply only once, so keep it complete." size="md">
        {replyFor && (
          <div className="space-y-4">
            <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>&ldquo;{replyFor.question}&rdquo;</p>
            <AdminTextarea rows={5} value={reply} onChange={(e) => { setReply(e.target.value.slice(0, 500)); setConfirm(false); }} aria-label="Your reply" placeholder="Write a clear answer (10 to 500 characters)" />
            <div className="flex justify-between text-xs" style={{ color: "var(--a-faint)" }}>
              <span>{clean !== reply.trim() && reply.trim() ? "Contact details will be hidden." : ""}</span><span>{reply.length}/500</span>
            </div>
            {confirm ? (
              <div className="grid grid-cols-2 gap-2">
                <AdminButton variant="ghost" onClick={() => setConfirm(false)}>Edit</AdminButton>
                <AdminButton onClick={() => finish(replyFor, clean, "replied")}>Send now</AdminButton>
              </div>
            ) : (
              <AdminButton className="w-full" disabled={!valid} onClick={() => setConfirm(true)}>Review and send</AdminButton>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
