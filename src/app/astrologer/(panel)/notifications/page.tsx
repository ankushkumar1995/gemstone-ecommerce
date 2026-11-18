"use client";

/**
 * Notifications: account events (KYC, status, profile review, agreement) and
 * admin announcements, from the server. Click to mark read; "Load more" pages
 * back in time. Kept for 180 days.
 */

import { useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, FileCheck2, FileSignature, Megaphone, Settings2, UserRound, BadgeCheck, ArrowRight } from "lucide-react";
import { AdminButton, Card, PageHeader, StatsSkeleton, Tabs, useAdminToast, useOnMount } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";
import type { NoticeKind, PartnerNotification } from "@/modules/partner-notices/notice.types";
import { usePartner } from "../../_components/partner-context";
import { timeAgo } from "../../_components/demo";

const KIND: Record<NoticeKind, { icon: typeof Bell; label: string }> = {
  announcement: { icon: Megaphone, label: "Announcements" },
  kyc: { icon: FileCheck2, label: "KYC" },
  status: { icon: BadgeCheck, label: "Account" },
  profile: { icon: UserRound, label: "Profile" },
  agreement: { icon: FileSignature, label: "Agreement" },
  system: { icon: Settings2, label: "System" },
};
type TabKey = "all" | "unread" | NoticeKind;

export default function NotificationsPage() {
  const { setUnread } = usePartner();
  const { toast } = useAdminToast();
  const [items, setItems] = useState<PartnerNotification[] | null>(null);
  const [unread, setUnreadLocal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");

  const sync = (n: number) => { setUnreadLocal(n); setUnread(n); };
  const load = async () => {
    const r = await partnerApi.notices.list();
    if (!r.ok) { toast(r.message, "error"); setItems([]); return; }
    setItems(r.data.items); setNext(r.data.nextBefore); sync(r.data.unread);
  };
  useOnMount(load);

  if (!items) return <StatsSkeleton count={2} />;
  const shown = items.filter((n) => tab === "all" || (tab === "unread" ? !n.readAt : n.kind === tab));

  const more = async () => {
    if (!next) return;
    const r = await partnerApi.notices.list(next);
    if (!r.ok) { toast(r.message, "error"); return; }
    setItems((l) => [...(l ?? []), ...r.data.items]); setNext(r.data.nextBefore);
  };
  const read = async (n: PartnerNotification) => {
    if (n.readAt) return;
    setItems((l) => (l ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    const r = await partnerApi.notices.markRead([n.id]);
    if (r.ok) sync(r.data.unread);
  };
  const readAll = async () => {
    const r = await partnerApi.notices.markRead("all");
    if (!r.ok) { toast(r.message, "error"); return; }
    setItems((l) => (l ?? []).map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    sync(r.data.unread);
    toast("All marked as read", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "All caught up"}
        action={<AdminButton variant="outline" disabled={!unread} onClick={readAll}><CheckCheck size={15} /> Mark all read</AdminButton>}
      />

      <Card className="p-0">
        <div className="overflow-x-auto px-2">
          <Tabs<TabKey> value={tab} onChange={setTab} tabs={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread", count: unread || undefined },
            ...(Object.keys(KIND) as NoticeKind[]).map((k) => ({ value: k, label: KIND[k].label })),
          ]} />
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {shown.length === 0 && (
            <li className="flex flex-col items-center gap-2 py-12 text-sm" style={{ color: "var(--a-faint)" }}>
              <Bell size={24} /> {tab === "unread" ? "No unread notifications." : "Nothing here yet. Updates about your account show up here."}
            </li>
          )}
          {shown.map((n) => {
            const I = KIND[n.kind]?.icon ?? Bell;
            const content = (
              <>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}><I size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.readAt ? "" : "font-semibold"}`} style={{ color: "var(--a-fg)" }}>{n.title}</p>
                  <p className="whitespace-pre-line text-sm" style={{ color: "var(--a-muted)" }}>{n.body}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--a-faint)" }}>{timeAgo(n.createdAt)}</p>
                </div>
                {n.link && n.link !== "/astrologer" && <ArrowRight size={15} className="mt-1 shrink-0" style={{ color: "var(--a-faint)" }} />}
                {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c9942a]" aria-label="Unread" />}
              </>
            );
            const cls = "flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-black/[0.02]";
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={cls} onClick={() => void read(n)}>{content}</Link>
                ) : (
                  <button type="button" className={cls} onClick={() => void read(n)}>{content}</button>
                )}
              </li>
            );
          })}
        </ul>
        {next && <div className="border-t p-3 text-center" style={{ borderColor: "var(--a-border)" }}><AdminButton variant="ghost" onClick={more}>Load more</AdminButton></div>}
      </Card>
    </div>
  );
}
