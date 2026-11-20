"use client";

/**
 * Admin: push notifications. Devices that can receive pushes, what went out in
 * the last 24 hours, why some did not go (customer turned it off, no device,
 * quiet hours…), the latest notifications, and a test send to one customer.
 * Rules (on/off, groups, quiet hours, limits) live in Program settings.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Send, Settings } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, Modal, PageHeader, StatsSkeleton, Tabs, useAdminToast } from "@/app/admin/_components";
import { astroAdminApi, type AdminPushStats, type PushRowView } from "@/lib/admin-astro-api";

type Tab = "all" | "sent" | "queued" | "skipped" | "failed";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "-");
const TONE: Record<PushRowView["status"], "green" | "gold" | "muted" | "rose" | "blue"> = { sent: "green", queued: "gold", sending: "blue", skipped: "muted", failed: "rose", expired: "muted" };
const REASON: Record<string, string> = {
  disabled: "Push is off", group_off: "Group turned off", pref_off: "Customer turned it off", no_device: "No phone registered",
  daily_cap: "Daily limit reached", stale: "No longer true", expired_in_quiet: "Out of date after quiet hours", expired: "Expired",
  DeviceNotRegistered: "App removed / token dead",
};
const GROUP: Record<string, string> = { live: "Live", reminders: "Reminder", chat: "Chat", wallet: "Wallet", orders: "Orders" };

export function PushAdminView() {
  const { toast } = useAdminToast();
  const [tab, setTab] = useState<Tab>("all");
  const [data, setData] = useState<AdminPushStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [t, setT] = useState({ who: "", title: "Test notification", body: "Push notifications are working on this phone." });

  const load = useCallback(async (before?: string) => {
    setBusy(true);
    const r = await astroAdminApi.push.stats({ status: tab === "all" ? undefined : tab, before });
    setBusy(false);
    if (!r.ok) return toast(r.message, "error");
    setData((cur) => (before && cur ? { ...r.data, rows: [...cur.rows, ...r.data.rows] } : r.data));
  }, [tab, toast]);

  useEffect(() => { const x = setTimeout(() => { void load(); }, 0); return () => clearTimeout(x); }, [load]);

  async function sendTest() {
    const who = t.who.trim();
    const isId = /^[a-f0-9]{24}$/i.test(who);
    const r = await astroAdminApi.push.test({ ...(isId ? { customerId: who } : { phone: who }), title: t.title.trim(), body: t.body.trim() });
    if (!r.ok) return toast(r.message, "error");
    toast(r.data.devices ? `Queued for ${r.data.devices} phone${r.data.devices === 1 ? "" : "s"}.` : "Saved to their inbox. They have no phone registered for push yet.", r.data.devices ? "success" : "info");
    setTestOpen(false);
    setTimeout(() => { void load(); }, 1500);
  }

  if (!data) return <StatsSkeleton count={4} />;
  const s = data.last24h;
  const total = Object.values(s).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Push notifications" subtitle="Alerts sent to the customer app: live, chat, wallet, orders and bookings."
        action={<div className="flex gap-2">
          <Link href="/admin/astrologers/settings"><AdminButton variant="outline"><Settings size={15} /> Rules</AdminButton></Link>
          <AdminButton variant="outline" onClick={() => load()} loading={busy}><RefreshCw size={15} /> Refresh</AdminButton>
          <AdminButton onClick={() => setTestOpen(true)}><Send size={15} /> Send a test</AdminButton>
        </div>} />

      {!data.expoTokenSet && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          EXPO_ACCESS_TOKEN is not set on the server. Pushes still work. For extra safety, create an access token in Expo, add it to the server environment, then turn on &quot;Enhanced push security&quot; in Expo.
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat k="Phones that can get pushes" v={String(data.devices.active)} sub={`${data.devices.customers} customers`} />
        <Stat k="Sent (24 h)" v={String(s.sent ?? 0)} sub={`${total} total`} />
        <Stat k="Waiting (24 h)" v={String((s.queued ?? 0) + (s.sending ?? 0))} sub="Quiet hours or retry" />
        <Stat k="Not sent (24 h)" v={String((s.skipped ?? 0) + (s.expired ?? 0))} sub="By rule, see reasons" />
        <Stat k="Failed (24 h)" v={String(s.failed ?? 0)} sub={`${data.devices.disabled} phones turned off`} />
      </div>

      {Object.keys(data.reasons).length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Why some were not sent (24 h)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => <Badge key={k} tone="muted">{REASON[k] ?? k}: {n}</Badge>)}
          </div>
        </Card>
      )}

      <Tabs<Tab> variant="pills" value={tab} onChange={setTab} tabs={[
        { value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "queued", label: "Waiting" }, { value: "skipped", label: "Not sent" }, { value: "failed", label: "Failed" },
      ]} />

      {data.rows.length === 0 ? (
        <Card className="py-12 text-center"><p className="text-sm" style={{ color: "var(--a-muted)" }}>No notifications here yet.</p></Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
                <th className="px-4 py-3">Notification</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b align-top" style={{ borderColor: "var(--a-border)" }}>
                  <td className="px-4 py-3"><p className="font-medium" style={{ color: "var(--a-fg)" }}>{r.title}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{r.body}</p></td>
                  <td className="px-4 py-3"><Link href={`/admin/customers/${r.customerId}`} className="font-mono text-xs hover:underline">{r.customerId.slice(-8)}</Link></td>
                  <td className="px-4 py-3 text-xs">{GROUP[r.group] ?? r.group}<p style={{ color: "var(--a-faint)" }}>{r.kind}</p></td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    {r.status === "sent" && <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{r.devices} phone{r.devices === 1 ? "" : "s"}{r.delivered ? `, ${r.delivered} confirmed` : ""}</p>}
                    {r.reason && r.status !== "sent" && <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{REASON[r.reason] ?? r.reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">{when(r.createdAt)}{r.sentAt && r.sentAt.slice(0, 16) !== r.createdAt.slice(0, 16) ? <p style={{ color: "var(--a-muted)" }}>sent {when(r.sentAt)}</p> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.nextBefore && <div className="p-3 text-center"><AdminButton variant="outline" loading={busy} onClick={() => load(data.nextBefore!)}>Load more</AdminButton></div>}
        </Card>
      )}

      <Modal open={testOpen} onClose={() => setTestOpen(false)} title="Send a test notification" subtitle="To one customer's phones. Ignores quiet hours; also shows in their inbox." size="sm">
        <div className="space-y-4">
          <Field label="Customer phone or id"><AdminInput value={t.who} onChange={(e) => setT({ ...t, who: e.target.value })} placeholder="98XXXXXXXX" /></Field>
          <Field label="Title"><AdminInput value={t.title} maxLength={80} onChange={(e) => setT({ ...t, title: e.target.value })} /></Field>
          <Field label="Message"><AdminInput value={t.body} maxLength={200} onChange={(e) => setT({ ...t, body: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <AdminButton variant="outline" onClick={() => setTestOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={sendTest} disabled={!t.who.trim() || t.title.trim().length < 2 || t.body.trim().length < 2}><Send size={14} /> Send</AdminButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs" style={{ color: "var(--a-muted)" }}>{k}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--a-fg)" }}>{v}</p>
      {sub && <p className="text-xs" style={{ color: "var(--a-faint)" }}>{sub}</p>}
    </Card>
  );
}
