"use client";

/**
 * Followers (DEMO list). Who follows you, growth, and what reaches them.
 *   • "Online now" alert: automatic when you go online, at most once every
 *     3 hours (followers are never spammed); followers can mute you
 *   • Announcement: one per 24 hours, 10–140 chars, contact details masked,
 *     checked by moderation before it is sent
 *   • followers are shown by first name + initial only
 */

import { useMemo, useState } from "react";
import { BellRing, Heart, Megaphone, Radio, TrendingUp, UserPlus } from "lucide-react";
import { AdminButton, AdminTextarea, Badge, Card, Field, LineChart, PageHeader, SearchInput, StatCard, StatsSkeleton, Toggle, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, maskContacts, nowMs, timeAgo } from "../../_components/demo";
import { ANNOUNCE_COOLDOWN_MS, FOLLOWER_ALERT_COOLDOWN_MS, followerSettingsStore, useStore } from "../../_components/demo-store";
import { MOCK_FOLLOWERS, MOCK_FOLLOWER_GROWTH } from "../../_components/mock-data";

const H = 3600_000;

export default function FollowersPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const settings = useStore(followerSettingsStore);
  const [now, setNow] = useState(0);
  const [q, setQ] = useState("");
  const [via, setVia] = useState<"all" | "Profile" | "Live" | "Session">("all");
  const [text, setText] = useState("");
  useOnMount(() => setNow(nowMs()));

  const list = useMemo(() => MOCK_FOLLOWERS.filter((f) => (via === "all" || f.via === via) && (!q.trim() || f.name.toLowerCase().includes(q.trim().toLowerCase()) || f.city.toLowerCase().includes(q.trim().toLowerCase()))), [q, via]);

  if (loading || !me || !now) return <StatsSkeleton count={4} />;
  const total = MOCK_FOLLOWER_GROWTH[MOCK_FOLLOWER_GROWTH.length - 1];
  const week = total - MOCK_FOLLOWER_GROWTH[MOCK_FOLLOWER_GROWTH.length - 8];
  const month = total - MOCK_FOLLOWER_GROWTH[0];
  const alertsOn = Math.round((MOCK_FOLLOWERS.filter((f) => f.alerts).length / MOCK_FOLLOWERS.length) * 100);
  const neverConsulted = Math.round((MOCK_FOLLOWERS.filter((f) => f.sessions === 0).length / MOCK_FOLLOWERS.length) * 100);
  const nextAlertAt = settings.lastNotifiedAt ? settings.lastNotifiedAt + FOLLOWER_ALERT_COOLDOWN_MS : null;
  const nextAnnounceAt = settings.lastAnnouncedAt ? settings.lastAnnouncedAt + ANNOUNCE_COOLDOWN_MS : null;
  const canAnnounce = !nextAnnounceAt || now >= nextAnnounceAt;
  const clean = maskContacts(text.trim());
  const valid = clean.length >= 10 && clean.length <= 140;

  const announce = () => {
    if (!valid || !canAnnounce) return;
    const t = nowMs();
    followerSettingsStore.set({ ...settings, lastAnnouncedAt: t, announcements: [{ text: clean, at: new Date(t).toISOString(), status: "in_review" as const }, ...settings.announcements].slice(0, 20) });
    setText("");
    setNow(t);
    toast("Sent for a quick check. It reaches followers within 15 minutes.", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Followers" subtitle="People who want to know when you are available" />
      <DemoBanner />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={Heart} value={total.toLocaleString("en-IN")} label="Followers" tone="rose" />
        <StatCard icon={UserPlus} value={`+${week}`} label="This week" tone="green" />
        <StatCard icon={BellRing} value={`${alertsOn}%`} label="Have alerts on" tone="gold" />
        <StatCard icon={TrendingUp} value={`${neverConsulted}%`} label="Never consulted yet" tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="p-5">
          <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>Growth, last 30 days · +{month}</p>
          <p className="mb-3 text-xs" style={{ color: "var(--a-muted)" }}>The jump 3 days ago came from your live “Shani gochar 2026”.</p>
          <LineChart data={MOCK_FOLLOWER_GROWTH} height={170} />
        </Card>
        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><BellRing size={16} /> “Online now” alerts</p>
          <Toggle checked={settings.autoNotify} onChange={(v) => followerSettingsStore.set({ ...settings, autoNotify: v })} label="Alert followers when I go online" />
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>At most once every 3 hours, so followers are not disturbed.</p>
          <p className="text-sm" style={{ color: "var(--a-fg)" }}>
            {settings.lastNotifiedAt ? <>Last alert {timeAgo(new Date(settings.lastNotifiedAt).toISOString())}. {nextAlertAt && now < nextAlertAt ? `Next possible in ${Math.ceil((nextAlertAt - now) / H)} h.` : "Next one goes out when you go online."}</> : "No alert sent yet. One goes out the next time you go online."}
          </p>
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><Radio size={12} /> Going live always alerts followers who turned on live alerts.</p>
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Megaphone size={16} /> Message your followers</p>
        <Field label="Announcement" hint={`${clean.length}/140 · one per day · checked before sending`}>
          <AdminTextarea rows={2} value={text} onChange={(e) => setText(e.target.value.slice(0, 140))} placeholder="e.g. Aaj shaam 7 baje Shani gochar par live aa raha hoon" disabled={!canAnnounce} />
        </Field>
        {clean !== text.trim() && text.trim() && <p className="text-xs text-amber-700">Contact details will be hidden.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <AdminButton onClick={announce} disabled={!valid || !canAnnounce}>Send to {total.toLocaleString("en-IN")} followers</AdminButton>
          {!canAnnounce && nextAnnounceAt && <span className="text-xs" style={{ color: "var(--a-muted)" }}>Next announcement in {Math.ceil((nextAnnounceAt - now) / H)} h</span>}
        </div>
        {settings.announcements.length > 0 && (
          <ul className="space-y-1.5 border-t pt-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
            {settings.announcements.map((a, i) => <li key={i} className="flex items-start justify-between gap-2"><span style={{ color: "var(--a-fg)" }}>{a.text}<span className="block text-xs" style={{ color: "var(--a-muted)" }}>{timeAgo(a.at)}</span></span><Badge tone={a.status === "sent" ? "green" : "gold"}>{a.status === "sent" ? "Sent" : "In review"}</Badge></li>)}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search name or city" className="min-w-[14rem] flex-1" />
          <div className="flex gap-1.5">
            {(["all", "Profile", "Live", "Session"] as const).map((v) => <button key={v} type="button" aria-pressed={via === v} onClick={() => setVia(v)} className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: via === v ? "var(--a-gold-soft)" : "var(--a-surface-2)", color: via === v ? "var(--a-gold)" : "var(--a-muted)" }}>{v === "all" ? "All" : `From ${v.toLowerCase()}`}</button>)}
          </div>
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span><span className="font-medium" style={{ color: "var(--a-fg)" }}>{f.name}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{f.city} · followed {timeAgo(f.since)} via {f.via.toLowerCase()}</span></span>
              <span className="flex items-center gap-2">
                <Badge tone={f.sessions ? "green" : "muted"}>{f.sessions ? `${f.sessions} sessions` : "No session yet"}</Badge>
                {!f.alerts && <Badge tone="muted">Alerts muted</Badge>}
              </span>
            </li>
          ))}
          {list.length === 0 && <li className="py-8 text-center text-sm" style={{ color: "var(--a-faint)" }}>No followers match.</li>}
        </ul>
        <p className="mt-2 text-[11px]" style={{ color: "var(--a-faint)" }}>Showing the latest {MOCK_FOLLOWERS.length}. Followers cannot be messaged one by one; use My customers for people you consulted.</p>
      </Card>
    </div>
  );
}
