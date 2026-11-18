"use client";

/**
 * Admin → Partner Announcements. Write a message, pick who gets it, publish.
 * Each partner gets it in their notifications and on their dashboard; the
 * list shows how many received and read it. Archive takes it off dashboards.
 */

import { useState } from "react";
import { Archive, Megaphone, Pin, Send } from "lucide-react";
import { astroAdminApi } from "@/lib/admin-astro-api";
import type { AnnouncementWithStats } from "@/modules/partner-notices/notice.types";
import {
  AdminBreadcrumb, AdminButton, AdminInput, AdminTextarea, Badge, Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader, ProgressBar,
  SegmentedControl, StatsSkeleton, Toggle, useAdminToast, useOnMount,
} from "../../../_components";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AnnouncementsManager() {
  const { toast } = useAdminToast();
  const [items, setItems] = useState<AnnouncementWithStats[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", audience: "approved" as "all" | "approved", pinned: false });
  const [askArchive, setAskArchive] = useState<AnnouncementWithStats | null>(null);

  const load = async () => {
    const r = await astroAdminApi.announcements.list();
    if (r.ok) setItems(r.data); else { toast(r.message, "error"); setItems([]); }
  };
  useOnMount(load);

  const publish = async () => {
    const r = await astroAdminApi.announcements.publish({ ...f, title: f.title.trim(), body: f.body.trim() });
    if (!r.ok) { toast(r.message, "error"); return; }
    toast(`Sent to ${r.data.sentTo} partner${r.data.sentTo === 1 ? "" : "s"}`, "success");
    setOpen(false);
    setF({ title: "", body: "", audience: "approved", pinned: false });
    await load();
  };
  const archive = async () => {
    if (!askArchive) return;
    const r = await astroAdminApi.announcements.archive(askArchive.id);
    if (r.ok) { toast("Archived. It no longer shows on dashboards.", "success"); await load(); } else toast(r.message, "error");
  };

  if (!items) return <StatsSkeleton count={2} />;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Astrologers", href: "/admin/astrologers" }, { label: "Announcements" }]} />
      <PageHeader
        title="Partner Announcements"
        subtitle="Messages to astrologers. They get it in notifications and on their dashboard."
        action={<AdminButton onClick={() => setOpen(true)}><Megaphone size={16} />New announcement</AdminButton>}
      />

      {items.length === 0 ? (
        <EmptyState title="No announcements yet" message="Send your first message to partners, for example peak-hour reminders or new rules." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const pct = a.sentTo ? Math.round((a.readCount / a.sentTo) * 100) : 0;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && <Pin size={14} style={{ color: "var(--a-gold)" }} />}
                      <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{a.title}</p>
                      <Badge tone={a.status === "published" ? "green" : "muted"}>{a.status === "published" ? "Live" : "Archived"}</Badge>
                      <Badge tone="blue">{a.audience === "approved" ? "Approved partners" : "All active partners"}</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm" style={{ color: "var(--a-muted)" }}>{a.body}</p>
                    <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>{fmt(a.createdAt)} · by {a.createdBy}{a.archivedAt ? ` · archived ${fmt(a.archivedAt)}` : ""}</p>
                  </div>
                  <div className="w-48 shrink-0">
                    <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--a-muted)" }}><span>Read {a.readCount} of {a.sentTo}</span><span>{pct}%</span></div>
                    <ProgressBar value={pct} tone={pct >= 80 ? "green" : "gold"} />
                    {a.status === "published" && <AdminButton variant="ghost" className="mt-2 w-full" onClick={() => setAskArchive(a)}><Archive size={14} />Archive</AdminButton>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New announcement" subtitle="Partners see it right away. You cannot edit it after sending." size="md">
        <div className="space-y-4">
          <Field label="Title" required><AdminInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value.slice(0, 140) })} placeholder="Diwali weekend: high demand" /></Field>
          <Field label="Message" required hint={`${f.body.length}/2000`}><AdminTextarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value.slice(0, 2000) })} placeholder="Customers get a 20% bonus this weekend. Please stay online 6 pm to 11 pm." /></Field>
          <Field label="Send to">
            <SegmentedControl
              value={f.audience}
              onChange={(v) => setF({ ...f, audience: v as "all" | "approved" })}
              options={[{ value: "approved", label: "Approved partners" }, { value: "all", label: "All active (incl. applicants)" }]}
            />
          </Field>
          <Toggle checked={f.pinned} onChange={(v) => setF({ ...f, pinned: v })} label="Pin on top of the dashboard" />
          <AdminButton className="w-full" onClick={publish} disabled={f.title.trim().length < 3 || f.body.trim().length < 10}><Send size={15} />Send announcement</AdminButton>
        </div>
      </Modal>

      <ConfirmDialog open={!!askArchive} onClose={() => setAskArchive(null)} onConfirm={archive} title="Archive this announcement?" message="It disappears from partner dashboards. It stays in their notification history." confirmLabel="Archive" />
    </div>
  );
}
