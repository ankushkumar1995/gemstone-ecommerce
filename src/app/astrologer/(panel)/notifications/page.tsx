"use client";

/**
 * Notifications (DEMO). Inbox with filters and read state, plus delivery
 * preferences per type. Security and payout alerts cannot be switched off.
 */

import { useState } from "react";
import { Bell, BellRing, CheckCheck, FileCheck2, IndianRupee, Megaphone, Settings2, Star } from "lucide-react";
import { AdminButton, Card, PageHeader, StatsSkeleton, Tabs, Toggle, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { DemoBanner, timeAgo } from "../../_components/demo";
import { MOCK_NOTIFICATIONS, type MockNotification } from "../../_components/mock-data";

const KIND = {
  request: { icon: BellRing, label: "Requests" },
  payout: { icon: IndianRupee, label: "Payouts" },
  review: { icon: Star, label: "Reviews" },
  admin: { icon: Megaphone, label: "Announcements" },
  system: { icon: Settings2, label: "System" },
  kyc: { icon: FileCheck2, label: "KYC" },
} as const;
type Kind = keyof typeof KIND;
const LOCKED: Kind[] = ["payout", "kyc", "system"];

export default function NotificationsPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [items, setItems] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);
  const [tab, setTab] = useState<"all" | "unread" | Kind>("all");
  const [prefs, setPrefs] = useState<Record<Kind, { panel: boolean; email: boolean; whatsapp: boolean }>>({
    request: { panel: true, email: false, whatsapp: true },
    payout: { panel: true, email: true, whatsapp: true },
    review: { panel: true, email: false, whatsapp: false },
    admin: { panel: true, email: true, whatsapp: false },
    system: { panel: true, email: true, whatsapp: false },
    kyc: { panel: true, email: true, whatsapp: true },
  });

  if (loading || !me) return <StatsSkeleton count={2} />;
  const unread = items.filter((n) => !n.read).length;
  const shown = items.filter((n) => tab === "all" || (tab === "unread" ? !n.read : n.kind === tab));

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "All caught up"} action={<AdminButton variant="outline" disabled={!unread} onClick={() => setItems((l) => l.map((n) => ({ ...n, read: true })))}><CheckCheck size={15} /> Mark all read</AdminButton>} />
      <DemoBanner />

      <Card className="p-0">
        <div className="overflow-x-auto px-2"><Tabs tabs={[{ value: "all", label: "All" }, { value: "unread", label: "Unread", count: unread }, ...(Object.keys(KIND) as Kind[]).map((k) => ({ value: k, label: KIND[k].label }))]} value={tab} onChange={setTab} /></div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {shown.length === 0 && <li className="flex flex-col items-center py-12 text-sm" style={{ color: "var(--a-faint)" }}><Bell size={24} /> Nothing here.</li>}
          {shown.map((n) => {
            const I = KIND[n.kind].icon;
            return (
              <li key={n.id}>
                <button type="button" onClick={() => setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: !x.read } : x)))} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-black/[0.02]" aria-label={`${n.title}. ${n.read ? "Read" : "Unread"}. Click to toggle.`}>
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}><I size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read ? "" : "font-semibold"}`} style={{ color: "var(--a-fg)" }}>{n.title}</p>
                    <p className="text-sm" style={{ color: "var(--a-muted)" }}>{n.body}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--a-faint)" }}>{timeAgo(n.at)}</p>
                  </div>
                  {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c9942a]" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5">
        <p className="mb-1 font-semibold" style={{ color: "var(--a-fg)" }}>How you want to be told</p>
        <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Payout, KYC and system alerts always reach you in the panel for your safety.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs" style={{ color: "var(--a-muted)" }}><th className="py-2 font-medium">Type</th><th className="font-medium">Panel</th><th className="font-medium">Email</th><th className="font-medium">WhatsApp</th></tr></thead>
            <tbody>
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <tr key={k} className="border-t" style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
                  <td className="py-3">{KIND[k].label}</td>
                  {(["panel", "email", "whatsapp"] as const).map((c) => {
                    const locked = c === "panel" && LOCKED.includes(k);
                    return (
                      <td key={c} className={locked ? "pointer-events-none opacity-50" : ""}>
                        <Toggle checked={prefs[k][c]} onChange={(v) => setPrefs({ ...prefs, [k]: { ...prefs[k], [c]: v } })} ariaLabel={`${KIND[k].label} by ${c}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminButton className="mt-4" onClick={() => toast("Preferences saved", "success")}>Save preferences</AdminButton>
      </Card>
    </div>
  );
}
