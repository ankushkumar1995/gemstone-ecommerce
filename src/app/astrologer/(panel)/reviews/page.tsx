"use client";

/**
 * Reviews (DEMO). Rating summary and distribution, tag insights, filters, a
 * public reply per review (one reply, editable), and "Report" for reviews that
 * break the guidelines (the admin decides; partners can never delete reviews).
 */

import { useMemo, useState } from "react";
import { Flag, MessageSquareReply, Star } from "lucide-react";
import { AdminButton, AdminSelect, AdminTextarea, Badge, Card, Field, Modal, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { CHANNEL_LABEL, DemoBanner, Stars, timeAgo } from "../../_components/demo";
import { MOCK_REVIEWS, type MockReview } from "../../_components/mock-data";

const REPORT_REASONS = ["Abusive or hateful language", "Contains personal information", "Not about my consultation", "Spam or fake", "Other"];

export default function ReviewsPage() {
  const { me, loading } = usePartner();
  const { toast } = useAdminToast();
  const [reviews, setReviews] = useState<MockReview[]>(MOCK_REVIEWS);
  const [filter, setFilter] = useState<"all" | "5" | "4" | "low" | "unreplied">("all");
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reported, setReported] = useState<string[]>([]);

  const stats = useMemo(() => {
    const n = reviews.length || 1;
    const avg = reviews.reduce((a, r) => a + r.rating, 0) / n;
    const dist = [5, 4, 3, 2, 1].map((s) => ({ s, c: reviews.filter((r) => r.rating === s).length }));
    const tags = new Map<string, number>();
    reviews.forEach((r) => r.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1)));
    return { avg, dist, tags: [...tags.entries()].sort((a, b) => b[1] - a[1]), replied: reviews.filter((r) => r.reply).length };
  }, [reviews]);

  if (loading || !me) return <StatsSkeleton count={3} />;
  const shown = reviews.filter((r) => filter === "all" || (filter === "5" && r.rating === 5) || (filter === "4" && r.rating === 4) || (filter === "low" && r.rating <= 3) || (filter === "unreplied" && !r.reply));

  const saveReply = () => {
    if (!replyFor || reply.trim().length < 2) return;
    setReviews((list) => list.map((r) => (r.id === replyFor ? { ...r, reply: reply.trim() } : r)));
    setReplyFor(null);
    setReply("");
    toast("Reply posted. It shows publicly under the review.", "success");
  };
  const sendReport = () => {
    if (!reportFor) return;
    setReported((r) => [...r, reportFor]);
    setReportFor(null);
    toast("Reported. The admin team reviews it within 48 hours.", "info");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" subtitle={`${reviews.length} reviews · ${stats.replied} replied`} />
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="space-y-4 p-5">
          <div className="text-center">
            <p className="text-4xl font-bold" style={{ color: "var(--a-fg)" }}>{stats.avg.toFixed(1)}</p>
            <Stars value={stats.avg} size={18} />
            <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>{reviews.length} ratings</p>
          </div>
          <ul className="space-y-1.5">
            {stats.dist.map(({ s, c }) => (
              <li key={s} className="flex items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}>
                <span className="w-6">{s}<Star size={10} className="ml-0.5 inline" /></span>
                <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--a-surface-2)" }}><span className="block h-full rounded-full bg-[#e6b43a]" style={{ width: `${(c / (reviews.length || 1)) * 100}%` }} /></span>
                <span className="w-5 text-right">{c}</span>
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>What customers say</p>
            <div className="flex flex-wrap gap-1.5">{stats.tags.map(([t, c]) => <Badge key={t} tone={["Slow replies", "Generic"].includes(t) ? "rose" : "green"}>{t} · {c}</Badge>)}</div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-end">
            <AdminSelect value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter reviews" className="w-48">
              <option value="all">All reviews</option><option value="5">5 stars</option><option value="4">4 stars</option><option value="low">3 stars and below</option><option value="unreplied">Not replied</option>
            </AdminSelect>
          </div>
          {shown.length === 0 && <Card className="py-10 text-center text-sm"><span style={{ color: "var(--a-faint)" }}>No reviews here.</span></Card>}
          {shown.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{r.customer}</p>
                <Stars value={r.rating} />
                <Badge tone="muted">{CHANNEL_LABEL[r.channel]}</Badge>
                <span className="ml-auto text-xs" style={{ color: "var(--a-muted)" }}>{timeAgo(r.at)}</span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--a-fg)" }}>{r.text}</p>
              {r.reply && <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}><span className="block text-[11px] font-semibold" style={{ color: "var(--a-gold)" }}>Your reply</span>{r.reply}</p>}
              <div className="mt-3 flex gap-2">
                <AdminButton variant="ghost" onClick={() => { setReplyFor(r.id); setReply(r.reply ?? ""); }}><MessageSquareReply size={15} /> {r.reply ? "Edit reply" : "Reply"}</AdminButton>
                {reported.includes(r.id) ? <Badge tone="gold">Reported</Badge> : <AdminButton variant="ghost" onClick={() => setReportFor(r.id)}><Flag size={15} /> Report</AdminButton>}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal open={!!replyFor} onClose={() => setReplyFor(null)} title="Reply to review" subtitle="Be polite. Replies are public and moderated." size="sm">
        <div className="space-y-4">
          <AdminTextarea rows={4} value={reply} onChange={(e) => setReply(e.target.value.slice(0, 500))} aria-label="Reply" />
          <p className="text-right text-xs" style={{ color: "var(--a-faint)" }}>{reply.length}/500</p>
          <AdminButton className="w-full" disabled={reply.trim().length < 2} onClick={saveReply}>Post reply</AdminButton>
        </div>
      </Modal>
      <Modal open={!!reportFor} onClose={() => setReportFor(null)} title="Report this review" subtitle="Reviews are removed only if they break the guidelines." size="sm">
        <div className="space-y-4">
          <Field label="Reason"><AdminSelect value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{REPORT_REASONS.map((x) => <option key={x}>{x}</option>)}</AdminSelect></Field>
          <AdminButton className="w-full" onClick={sendReport}>Send report</AdminButton>
        </div>
      </Modal>
    </div>
  );
}
