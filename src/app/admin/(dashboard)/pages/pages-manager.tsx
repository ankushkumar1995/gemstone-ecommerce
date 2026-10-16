"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileText, CheckCircle2, PencilRuler, Eye, Pencil, Trash2, Send, Archive } from "lucide-react";
import type { CmsPage } from "@/modules/pages";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
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

export function PagesManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<CmsPage | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.pages.list();
    if (res.ok) setPages(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const total = pages.length;
    const published = pages.filter((p) => p.status === "published").length;
    return { total, published, drafts: total - published };
  }, [pages]);

  const setStatus = async (p: CmsPage, status: CmsPage["status"]) => {
    const res = await adminApi.pages.update(p.id, { status });
    if (res.ok) {
      toast(status === "published" ? "Published" : "Moved to draft", "success");
      setPages((prev) => prev.map((x) => (x.id === p.id ? res.data : x)));
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.pages.remove(toDelete.id);
    if (res.ok) {
      toast("Page deleted", "success");
      setPages((prev) => prev.filter((x) => x.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const columns: Column<CmsPage>[] = [
    {
      key: "title",
      header: "Page",
      searchable: true,
      sortable: true,
      accessor: (p) => p.title,
      cell: (p) => (
        <div>
          <p className="font-medium" style={{ color: "var(--a-fg)" }}>{p.title}</p>
          <p className="font-mono text-xs" style={{ color: "var(--a-faint)" }}>/pages/{p.slug}</p>
        </div>
      ),
    },
    {
      key: "showInFooter",
      header: "Footer",
      accessor: (p) => (p.showInFooter ? "Yes" : "No"),
      cell: (p) => (p.showInFooter ? <Badge tone="royal">In footer</Badge> : <span style={{ color: "var(--a-faint)" }}>—</span>),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["published", "draft"],
      accessor: (p) => p.status,
      cell: (p) => <StatusPill tone={p.status === "published" ? "green" : "gold"}>{p.status}</StatusPill>,
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: true,
      align: "right",
      accessor: (p) => p.updatedAt,
      cell: (p) => <span className="text-sm" style={{ color: "var(--a-muted)" }}>{new Date(p.updatedAt).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pages"
        subtitle="Create static content pages (About, Policies, Terms…) shown on the storefront."
        action={
          <AdminButton onClick={() => router.push("/admin/pages/new")}>
            <Plus size={16} /> New Page
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={FileText} value={stats.total} label="Total Pages" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.published} label="Published" tone="green" />
          <StatCard icon={PencilRuler} value={stats.drafts} label="Drafts" tone="gold" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={pages}
          columns={columns}
          getRowId={(p) => p.id}
          loading={loading}
          searchPlaceholder="Search pages…"
          emptyTitle="No pages yet"
          emptyMessage="Create your first content page."
          onRefresh={load}
          onRowClick={(p) => router.push(`/admin/pages/${p.id}/edit`)}
          rowActions={(p) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/pages/${p.id}/edit`) },
                p.status === "published"
                  ? { label: "View on store", icon: Eye, onClick: () => window.open(`/pages/${p.slug}`, "_blank") }
                  : { label: "Publish", icon: Send, onClick: () => setStatus(p, "published") },
                p.status === "published"
                  ? { label: "Unpublish", icon: Archive, onClick: () => setStatus(p, "draft") }
                  : { label: "View on store", icon: Eye, onClick: () => window.open(`/pages/${p.slug}`, "_blank") },
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(p) },
              ]}
            />
          )}
        />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete page?"
        message={`"${toDelete?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
