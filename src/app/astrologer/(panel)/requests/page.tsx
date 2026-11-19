"use client";

/**
 * Live requests. Chat requests from customers arrive here in about a second
 * (long-poll inbox shared by the whole panel). Each request shows the customer,
 * their question and birth details, and a countdown; Accept opens the live
 * chat, Decline frees the customer to pick someone else. A request that runs
 * out of time is missed; repeated misses switch you offline (server rule).
 * Only one live chat at a time: Accept is off while one is running.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Check, MessageCircle, MessagesSquare, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { AdminButton, Badge, Card, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { partnerApi, type SessionView } from "@/lib/astrologer-api";
import { usePartner } from "../../_components/partner-context";
import { useConsultInbox } from "../../_components/consult-inbox";

const fmtDob = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

function useTick(ms: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [ms]);
  return now;
}

export default function LiveRequestsPage() {
  const { me, loading, goOnline, busy } = usePartner();
  const inbox = useConsultInbox();
  const { toast } = useAdminToast();
  const router = useRouter();
  const now = useTick(1000);
  const [working, setWorking] = useState<string | null>(null);

  if (loading || !me) return <StatsSkeleton count={3} />;
  if (me.status !== "approved") {
    return (
      <div className="space-y-6">
        <PageHeader title="Live requests" />
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>Chat requests open after your profile is approved.</p></Card>
      </div>
    );
  }

  const online = me.presence.online;
  const chatOn = me.presence.channels?.chat !== false;
  const { requests, active, ready, skew } = inbox;
  const serverNow = now + skew;

  async function accept(r: SessionView) {
    if (inbox.active) return toast("Finish your current chat first. One chat at a time.", "error");
    setWorking(r.id);
    const res = await partnerApi.consult.act(r.id, "accept");
    setWorking(null);
    inbox.forget(r.id);
    inbox.refresh();
    if (!res.ok) return toast(res.message, "error");
    router.push(`/astrologer/session?id=${encodeURIComponent(r.id)}`);
  }

  async function decline(r: SessionView) {
    setWorking(r.id);
    const res = await partnerApi.consult.act(r.id, "decline");
    setWorking(null);
    inbox.forget(r.id);
    inbox.refresh();
    if (!res.ok) return toast(res.message, "error");
    toast("Request declined. The customer can pick another astrologer.", "info");
  }

  async function turnOn() {
    const err = await goOnline({ chat: true });
    if (err) toast(err, "error");
    else toast("You are online for chat.", "success");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Live requests" subtitle="Accept before the timer runs out. Missing several in a row switches you offline." />

      {inbox.offlineNet && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <WifiOff size={16} /> Connection lost. Reconnecting…
        </div>
      )}

      {active && (
        <Card className="flex flex-wrap items-center gap-3 p-4 ring-2 ring-emerald-400">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700"><MessagesSquare size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Live chat with {active.customer.name}</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>{active.billing === "waiting_reply" ? "Waiting for your first reply" : `${active.minutesCharged} min so far`}</p>
          </div>
          <Link href={`/astrologer/session?id=${encodeURIComponent(active.id)}`}><AdminButton>Open chat</AdminButton></Link>
        </Card>
      )}

      {inbox.waiting > 0 && (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}><b>{inbox.waiting}</b> {inbox.waiting === 1 ? "person is" : "people are"} waiting in your line. The next one gets their turn when your chat ends.</p>
          <Link href="/astrologer/waitlist"><AdminButton variant="outline">Open waitlist</AdminButton></Link>
        </Card>
      )}

      {/* readiness */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className={`h-3 w-3 rounded-full ${online && chatOn ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{!online ? "You are offline" : chatOn ? "Online for chat" : "Chat is switched off"}</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>{online && chatOn ? "Customers can send you chat requests" : "Customers cannot reach you now"}</p>
          </div>
          {(!online || !chatOn) && <AdminButton onClick={turnOn} loading={busy}>Go online</AdminButton>}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          {inbox.sound ? <Volume2 size={18} className="text-emerald-600" /> : <VolumeX size={18} style={{ color: "var(--a-muted)" }} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Ring sound</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>Rings on any panel page while a request waits</p>
          </div>
          {inbox.sound
            ? <AdminButton variant="ghost" onClick={inbox.muteSound}>Mute</AdminButton>
            : <AdminButton onClick={async () => { if (!(await inbox.enableSound())) toast("Sound is not supported in this browser", "error"); }}>Turn on</AdminButton>}
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Bell size={18} style={{ color: inbox.notifPerm === "granted" ? "var(--a-green)" : "var(--a-muted)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Desktop alerts</p>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>
              {inbox.notifPerm === "granted" ? "On. You get an alert when this tab is in the background." : inbox.notifPerm === "denied" ? "Blocked in browser settings" : inbox.notifPerm === "unsupported" ? "Not supported here" : "Get alerts in other tabs"}
            </p>
          </div>
          {inbox.notifPerm === "default" && <AdminButton onClick={inbox.askNotif}>Allow</AdminButton>}
        </Card>
      </div>

      {(inbox.missedThisVisit > 0 || me.stats.missedStreak > 0) && (
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>
          Missed in a row: <b style={{ color: me.stats.missedStreak ? "#be123c" : "var(--a-fg)" }}>{me.stats.missedStreak}</b>
          {inbox.missedThisVisit > 0 && <> · missed during this visit: {inbox.missedThisVisit}</>}
        </p>
      )}

      {/* waiting */}
      <section aria-live="polite" aria-label="Waiting requests">
        {!ready ? (
          <StatsSkeleton count={2} />
        ) : requests.length === 0 ? (
          <Card className="flex flex-col items-center py-12 text-center">
            <BellRing size={28} style={{ color: "var(--a-faint)" }} />
            <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>No one waiting</p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>New requests appear here within a second. Keep the panel open while online.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((r) => {
              const total = Math.max(1, (Date.parse(r.expiresAt) - Date.parse(r.requestedAt)) / 1000);
              const left = now ? Math.max(0, Math.ceil((Date.parse(r.expiresAt) - serverNow) / 1000)) : Math.round(total);
              const pct = Math.min(100, (left / total) * 100);
              const intake = r.customer.intake;
              const mine = working === r.id;
              return (
                <Card key={r.id} className="relative overflow-hidden p-5 ring-2 ring-[#c9942a]">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--a-border)" }}>
                    <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: left <= 10 ? "#e11d48" : "var(--a-gold)" }} />
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}><MessageCircle size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{r.customer.name}</p>
                        <Badge tone="gold">Chat · ₹{r.rate}/min</Badge>
                        {r.freeMinutes > 0 && <Badge tone="green">{`New customer · ${r.freeMinutes} free min (AstroUnkle pays you)`}</Badge>}
                      </div>
                      {r.question
                        ? <p className="mt-1.5 break-words text-sm" style={{ color: "var(--a-fg)" }}>&ldquo;{r.question}&rdquo;</p>
                        : <p className="mt-1.5 text-sm" style={{ color: "var(--a-faint)" }}>No question added</p>}
                      {intake && (
                        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--a-muted)" }}>
                          <span>{intake.name}{intake.gender ? `, ${intake.gender}` : ""}</span>
                          <span>Born {fmtDob(intake.dob)}{intake.birthTime ? ` at ${intake.birthTime}` : ""}</span>
                          {intake.birthPlace && <span>{intake.birthPlace}</span>}
                        </p>
                      )}
                    </div>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: left <= 10 ? "#e11d48" : "var(--a-fg)" }} aria-label={`${left} seconds left`}>{left}s</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <AdminButton variant="danger" onClick={() => decline(r)} disabled={Boolean(working)}><X size={16} /> Decline</AdminButton>
                    <AdminButton onClick={() => accept(r)} disabled={Boolean(active) || left === 0 || (Boolean(working) && !mine)}><Check size={16} /> Accept</AdminButton>
                  </div>
                  {active && <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>End your live chat to accept another.</p>}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-sm" style={{ color: "var(--a-muted)" }}>
        Past chats are in <Link href="/astrologer/sessions" className="font-medium" style={{ color: "var(--a-gold)" }}>Sessions history</Link>.
      </p>
    </div>
  );
}
