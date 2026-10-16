"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquare, Check, X, Trash2, Clock, CheckCircle2, Reply } from "lucide-react";
import type { Review, ReviewStatus } from "@/modules/reviews";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import {
  PageHeader,
  StatCard,
  StatsSkeleton,
  Card,
  StatusPill,
  Avatar,
  AdminButton,
  AdminTextarea,
  Modal,
  ConfirmDialog,
  SegmentedControl,
  EmptyState,
  useAdminToast,
} from "../../_components";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      ))}
    </span>
  );
}

function timeAgo(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ReviewsManager() {
  const { toast } = useAdminToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [replyTo, setReplyTo] = useState<Review | null>(null);
  const [toDelete, setToDelete] = useState<Review | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.reviews.list();
    if (res.ok) setReviews(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const pending = reviews.filter((r) => r.status === "pending").length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const avg =
      approved > 0
        ? reviews.filter((r) => r.status === "approved").reduce((s, r) => s + r.rating, 0) / approved
        : 0;
    return { total: reviews.length, pending, approved, avg };
  }, [reviews]);

  const visible = useMemo(
    () => (filter === "all" ? reviews : reviews.filter((r) => r.status === filter)),
    [reviews, filter]
  );

  const moderate = async (r: Review, status: ReviewStatus) => {
    const res = await adminApi.reviews.update(r.id, { status });
    if (res.ok) {
      setReviews((prev) => prev.map((x) => (x.id === r.id ? res.data : x)));
      toast(status === "approved" ? "Review approved" : "Review rejected", "success");
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.reviews.remove(toDelete.id);
    if (res.ok) {
      setReviews((prev) => prev.filter((x) => x.id !== toDelete.id));
      toast("Review deleted", "success");
    } else toast(res.message, "error");
  };

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Moderate customer reviews. Approved reviews update the product's rating." />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={MessageSquare} value={stats.total} label="Total Reviews" tone="royal" />
          <StatCard icon={Clock} value={stats.pending} label="Pending" tone="gold" />
          <StatCard icon={CheckCircle2} value={stats.approved} label="Approved" tone="green" />
          <StatCard icon={Star} value={stats.avg.toFixed(1)} label="Avg Rating" tone="blue" />
        </div>
      )}

      <div className="mt-6 mb-4">
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as ReviewStatus | "all")}
          options={[
            { value: "pending", label: `Pending (${stats.pending})` },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      {loading ? null : visible.length === 0 ? (
        <Card>
          <EmptyState title="Nothing here" message="No reviews match this filter." />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {visible.map((r) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <Card>
                  <div className="flex flex-wrap items-start gap-4">
                    {/* product */}
                    <div className="flex items-center gap-2">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
                        {r.productImage && <Image src={r.productImage} alt="" fill sizes="44px" className="object-cover" />}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar name={r.authorName} size={24} />
                        <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{r.authorName}</span>
                        {r.verified && <StatusPill tone="green">Verified</StatusPill>}
                        <StatusPill tone={r.status === "approved" ? "green" : r.status === "rejected" ? "rose" : "gold"}>
                          {r.status}
                        </StatusPill>
                        <span className="text-xs" style={{ color: "var(--a-faint)" }}>· {timeAgo(r.createdAt)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Stars rating={r.rating} />
                        {r.title && <span className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{r.title}</span>}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>{r.body}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>on {r.productName}</p>

                      {r.reply && (
                        <div className="mt-3 rounded-lg border-l-2 pl-3" style={{ borderColor: "var(--a-gold)" }}>
                          <p className="text-xs font-semibold" style={{ color: "var(--a-gold)" }}>Store reply</p>
                          <p className="text-sm" style={{ color: "var(--a-muted)" }}>{r.reply}</p>
                        </div>
                      )}
                    </div>

                    {/* actions */}
                    <div className="flex shrink-0 gap-1.5">
                      {r.status !== "approved" && (
                        <button
                          onClick={() => moderate(r, "approved")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          onClick={() => moderate(r, "rejected")}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 transition-colors hover:bg-rose-500/20"
                          title="Reject"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setReplyTo(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05]"
                        style={{ color: "var(--a-muted)" }}
                        title="Reply"
                      >
                        <Reply size={16} />
                      </button>
                      <button
                        onClick={() => setToDelete(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {replyTo && (
        <ReplyModal
          review={replyTo}
          onClose={() => setReplyTo(null)}
          onSaved={(updated) => {
            setReviews((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setReplyTo(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete review?"
        message="This review will be permanently removed."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function ReplyModal({
  review,
  onClose,
  onSaved,
}: {
  review: Review;
  onClose: () => void;
  onSaved: (r: Review) => void;
}) {
  const { toast } = useAdminToast();
  const [reply, setReply] = useState(review.reply ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await adminApi.reviews.update(review.id, { reply });
    setSaving(false);
    if (res.ok) {
      toast("Reply saved", "success");
      onSaved(res.data);
    } else toast(res.message, "error");
  };

  return (
    <Modal open onClose={onClose} title="Reply to review" subtitle={`${review.authorName} · ${review.productName}`}>
      <div className="space-y-4">
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
          <Stars rating={review.rating} />
          <p className="mt-1.5 text-sm" style={{ color: "var(--a-muted)" }}>{review.body}</p>
        </div>
        <AdminTextarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a public reply…" />
        <div className="flex gap-3">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>Cancel</AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save reply"}</AdminButton>
        </div>
      </div>
    </Modal>
  );
}
