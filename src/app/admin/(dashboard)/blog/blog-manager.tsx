"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, FileText, CheckCircle2, PencilRuler, Star, Eye, Pencil, Trash2, Send, Archive } from "lucide-react";
import type { Article } from "@/types";
import { adminApi } from "@/lib/admin-api";
import {
  PageHeader,
  AdminButton,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  ConfirmDialog,
  Badge,
  useAdminToast,
  type Column,
} from "../../_components";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Article | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.articles.list();
    if (res.ok) setArticles(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = articles.length;
    const published = articles.filter((a) => a.status === "published").length;
    const drafts = total - published;
    const featured = articles.filter((a) => a.featured).length;
    return { total, published, drafts, featured };
  }, [articles]);

  const setStatus = async (a: Article, status: Article["status"]) => {
    const res = await adminApi.articles.update(a.id, { status });
    if (res.ok) {
      toast(status === "published" ? "Published" : "Moved to draft", "success");
      setArticles((prev) => prev.map((x) => (x.id === a.id ? res.data : x)));
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.articles.remove(toDelete.id);
    if (res.ok) {
      toast("Article deleted", "success");
      setArticles((prev) => prev.filter((x) => x.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const columns: Column<Article>[] = [
    {
      key: "title",
      header: "Article",
      searchable: true,
      sortable: true,
      accessor: (a) => a.title,
      cell: (a) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
            <Image src={a.image} alt={a.title} fill sizes="56px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>
              {a.title} {a.featured && <Star size={12} className="inline text-[var(--a-gold)]" />}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{a.author}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      filterable: true,
      accessor: (a) => a.category,
      cell: (a) => <Badge tone="royal">{a.category}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["published", "draft"],
      accessor: (a) => a.status,
      cell: (a) => <StatusPill tone={a.status === "published" ? "green" : "gold"}>{a.status}</StatusPill>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      align: "right",
      accessor: (a) => a.date,
      cell: (a) => <span className="text-sm" style={{ color: "var(--a-muted)" }}>{fmtDate(a.date)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle="Write and manage your gemstone journal. Published posts appear live on the storefront."
        action={
          <AdminButton onClick={() => router.push("/admin/blog/new")}>
            <Plus size={16} /> New Article
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} value={stats.total} label="Total Articles" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.published} label="Published" tone="green" />
          <StatCard icon={PencilRuler} value={stats.drafts} label="Drafts" tone="gold" />
          <StatCard icon={Star} value={stats.featured} label="Featured" tone="blue" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={articles}
          columns={columns}
          getRowId={(a) => a.id}
          loading={loading}
          searchPlaceholder="Search articles…"
          emptyTitle="No articles yet"
          emptyMessage="Write your first blog post."
          onRefresh={load}
          exportName="articles"
          onRowClick={(a) => router.push(`/admin/blog/${a.id}/edit`)}
          rowActions={(a) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/blog/${a.id}/edit`) },
                a.status === "published"
                  ? { label: "View on store", icon: Eye, onClick: () => window.open(`/blog/${a.slug}`, "_blank") }
                  : { label: "Publish", icon: Send, onClick: () => setStatus(a, "published") },
                a.status === "published"
                  ? { label: "Unpublish", icon: Archive, onClick: () => setStatus(a, "draft") }
                  : { label: "View on store", icon: Eye, onClick: () => window.open(`/blog/${a.slug}`, "_blank") },
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(a) },
              ]}
            />
          )}
        />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete article?"
        message={`"${toDelete?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
