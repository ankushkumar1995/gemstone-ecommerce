"use client";

/**
 * Waitlist (DEMO). Customers who chose to wait while you were busy or on a
 * break. Strictly first come, first served. You can start with #1, remove
 * someone with a reason (they are notified, never charged), and set the rules.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass, MessageCircle, Phone, Play, Sparkles, Trash2, UserMinus, Users, Video, Wallet } from "lucide-react";
import { AdminButton, AdminSelect, Badge, Card, Field, Modal, PageHeader, StatCard, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DEMO_SESSION_KEY, DemoBanner, nowMs } from "../../_components/demo";
import { queueSettingsStore, queueStore, useStore, type QueueEntry } from "../../_components/demo-store";
import { MAX_WAIT_MIN, estimateWait, nextDemoCustomer, removeFromQueue, tryJoin } from "../../_components/queue";
import { useOnBreak } from "../../_components/break-control";

const ICON = { chat: MessageCircle, call: Phone, video: Video } as const;
const REMOVE_REASONS = ["Ending my shift soon", "Not my area of expertise", "Customer asked to be removed", "Other"];

export default function WaitlistPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const router = useRouter();
  const queue = useStore(queueStore);
  const settings = useStore(queueSettingsStore);
  const { onBreak, keepQueue } = useOnBreak();
  const [now, setNow] = useState(0);
  const [hasActive, setHasActive] = useState(false);
  const [removing, setRemoving] = useState<QueueEntry | null>(null);
  const [reason, setReason] = useState(REMOVE_REASONS[0]);
  const [confirmClear, setConfirmClear] = useState(false);
  const seq = useRef(0);

  useOnMount(() => { setNow(nowMs()); setHasActive(Boolean(sessionStorage.getItem(DEMO_SESSION_KEY))); });
  useEffect(() => { const id = setInterval(() => setNow(nowMs()), 5000); return () => clearInterval(id); }, []);

  if (loading || !me) return <StatsSkeleton count={3} />;
  const online = me.presence.online;
  const accepting = online && (!onBreak || keepQueue);

  const simulateJoin = () => {
    const r = nextDemoCustomer(seq.current++);
    // Every 4th demo join has low balance to show the rule.
    const res = tryJoin({ customer: r.customer, customerId: r.customerId, channel: r.channel, rate: r.rate, question: r.question, walletMinutes: seq.current % 4 === 0 ? 3 : r.walletMinutes, birth: r.birth }, { acceptingQueue: accepting });
    toast(res.ok ? `${r.customer} joined the waitlist at #${res.position}` : res.reason, res.ok ? "success" : "error");
  };

  const start = (q: QueueEntry) => {
    if (hasActive) return toast("Finish your live session first. The next customer is offered automatically.", "error");
    if (onBreak) return toast("End your break first.", "error");
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ ...q, repeat: false, uid: q.id, startedAt: nowMs() }));
    removeFromQueue(q.id);
    router.push("/astrologer/session");
  };

  const remove = () => {
    if (!removing) return;
    removeFromQueue(removing.id);
    toast(`${removing.customer} was removed and notified. No charge.`, "info");
    setRemoving(null);
  };

  const avgWait = queue.length ? Math.round(queue.reduce((a, q) => a + (now - q.joinedAt), 0) / queue.length / 60000) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Waitlist" subtitle="Customers waiting for you, first come first served"
        action={<AdminButton variant="outline" onClick={simulateJoin}><Sparkles size={15} /> Simulate customer joining</AdminButton>} />
      <DemoBanner />

      {!accepting && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800" role="status">{!online ? "You are offline, so the waitlist is closed." : "You are on a break with the waitlist closed."}</p>}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Users} value={`${queue.length}/${settings.maxSize}`} label="Waiting" tone="royal" />
        <StatCard icon={Hourglass} value={`${avgWait} min`} label="Average wait so far" tone="gold" />
        <StatCard icon={Wallet} value={`${settings.minMinutes} min`} label="Min balance to join" tone="blue" />
        <StatCard icon={Play} value={settings.autoOffer ? "On" : "Off"} label="Auto-offer next" tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>In line</p>
            {queue.length > 0 && <AdminButton variant="ghost" onClick={() => setConfirmClear(true)}><Trash2 size={15} /> Clear all</AdminButton>}
          </div>
          {queue.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: "var(--a-faint)" }}>No one is waiting. When you are busy, customers can join here instead of leaving.</p>
          ) : (
            <ol className="space-y-3">
              {queue.map((q, i) => {
                const I = ICON[q.channel];
                const waited = Math.max(0, Math.floor((now - q.joinedAt) / 60000));
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: i === 0 ? "var(--a-gold)" : "var(--a-border)" }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: i === 0 ? "var(--a-gold-soft)" : "var(--a-surface-2)", color: i === 0 ? "var(--a-gold)" : "var(--a-muted)" }} aria-label={`Position ${i + 1}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}><I size={14} />{q.customer}<Badge tone="muted">{CHANNEL_LABEL[q.channel]} · ₹{q.rate}/min</Badge></p>
                      <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>&ldquo;{q.question}&rdquo;</p>
                      <p className="text-[11px]" style={{ color: waited >= MAX_WAIT_MIN - 5 ? "#be123c" : "var(--a-faint)" }}>
                        Waiting {waited} min · told about {estimateWait(i + 1, hasActive)} min · balance for ~{q.walletMinutes} min
                      </p>
                    </div>
                    {i === 0 && <AdminButton onClick={() => start(q)} disabled={hasActive || onBreak}><Play size={15} /> Start</AdminButton>}
                    <AdminButton variant="ghost" onClick={() => setRemoving(q)} aria-label={`Remove ${q.customer}`}><UserMinus size={15} /></AdminButton>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--a-faint)" }}>The order cannot be changed. Customers waiting over {MAX_WAIT_MIN} min are removed and told to try another astrologer.</p>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>Waitlist rules</p>
          <Toggle checked={settings.enabled} onChange={(v) => queueSettingsStore.set({ ...settings, enabled: v })} label="Allow customers to wait for me" />
          <Field label="Maximum waiting">
            <AdminSelect value={settings.maxSize} onChange={(e) => queueSettingsStore.set({ ...settings, maxSize: Number(e.target.value) })}>{[3, 5, 10, 20].map((n) => <option key={n} value={n}>{n} customers</option>)}</AdminSelect>
          </Field>
          <Field label="Customer must have balance for" hint="Avoids sessions that end in a minute">
            <AdminSelect value={settings.minMinutes} onChange={(e) => queueSettingsStore.set({ ...settings, minMinutes: Number(e.target.value) })}>{[5, 10, 15].map((n) => <option key={n} value={n}>{n} minutes</option>)}</AdminSelect>
          </Field>
          <Toggle checked={settings.autoOffer} onChange={(v) => queueSettingsStore.set({ ...settings, autoOffer: v })} label="Offer the next customer when my session ends" />
          {settings.maxSize < queue.length && <p className="text-xs text-amber-700">Lowering the limit does not remove people already waiting.</p>}
        </Card>
      </div>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={removing ? `Remove ${removing.customer}?` : ""} subtitle="They are told politely and can pick another astrologer. Nothing is charged." size="sm">
        <div className="space-y-4">
          <Field label="Reason (shown to the admin)"><AdminSelect value={reason} onChange={(e) => setReason(e.target.value)}>{REMOVE_REASONS.map((r) => <option key={r}>{r}</option>)}</AdminSelect></Field>
          <AdminButton className="w-full" variant="danger" onClick={remove}>Remove</AdminButton>
        </div>
      </Modal>
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear the whole waitlist?" subtitle="Everyone waiting is notified. Use this when you have to leave." size="sm">
        <AdminButton className="w-full" variant="danger" onClick={() => { const n = queue.length; queueStore.set([]); setConfirmClear(false); toast(`${n} customers notified`, "info"); }}>Clear and notify</AdminButton>
      </Modal>
    </div>
  );
}
