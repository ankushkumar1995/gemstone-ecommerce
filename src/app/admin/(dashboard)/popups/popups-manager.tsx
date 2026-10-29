"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MessageSquare,
  CheckCircle2,
  Pencil,
  Trash2,
  Eye,
  Send,
} from "lucide-react";
import type { Popup } from "@/modules/popups";
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

const TYPE_LABEL: Record<Popup["type"], string> = {
  promo: "Promo",
  newsletter: "Newsletter",
  lead: "Lead form",
  announcement: "Announcement",
  html: "Custom HTML",
};

export function PopupsManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Popup | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.popups.list();
    if (res.ok) setPopups(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const total = popups.length;
    const active = popups.filter((p) => p.enabled).length;
    const impressions = popups.reduce((s, p) => s + (p.analytics?.impressions ?? 0), 0);
    const submissions = popups.reduce((s, p) => s + (p.analytics?.submissions ?? 0), 0);
    return { total, active, impressions, submissions };
  }, [popups]);

  const toggleEnabled = async (p: Popup) => {
    const res = await adminApi.popups.update(p.id, { enabled: !p.enabled });
    if (res.ok) {
      setPopups((prev) => prev.map((x) => (x.id === p.id ? res.data : x)));
      toast(res.data.enabled ? "Popup enabled" : "Popup paused", "success");
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.popups.remove(toDelete.id);
    if (res.ok) {
      toast("Popup deleted", "success");
      setPopups((prev) => prev.filter((x) => x.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const columns: Column<Popup>[] = [
    {
      key: "name",
      header: "Popup",
      searchable: true,
      sortable: true,
      accessor: (p) => p.name,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{p.name}</p>
          <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
            {p.content.heading || p.content.body || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      filterable: true,
      filterOptions: Object.values(TYPE_LABEL),
      accessor: (p) => TYPE_LABEL[p.type],
      cell: (p) => <Badge tone="royal">{TYPE_LABEL[p.type]}</Badge>,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      align: "right",
      accessor: (p) => p.priority,
      cell: (p) => <span style={{ color: "var(--a-muted)" }}>{p.priority}</span>,
    },
    {
      key: "stats",
      header: "Impr. / Clicks / Subs",
      accessor: (p) => p.analytics?.impressions ?? 0,
      cell: (p) => {
        const a = p.analytics ?? { impressions: 0, clicks: 0, submissions: 0, dismissals: 0 };
        const ctr = a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 100) : 0;
        return (
          <span className="text-xs" style={{ color: "var(--a-muted)" }}>
            {a.impressions} / {a.clicks} ({ctr}%) / {a.submissions}
          </span>
        );
      },
    },
    {
      key: "enabled",
      header: "Status",
      filterable: true,
      filterOptions: ["Active", "Paused"],
      accessor: (p) => (p.enabled ? "Active" : "Paused"),
      cell: (p) =>
        p.enabled ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="gold">Paused</StatusPill>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Popups"
        subtitle="Create and target storefront popups — promos, email capture, lead forms & announcements."
        action={
          <AdminButton onClick={() => router.push("/admin/popups/new")}>
            <Plus size={16} /> New Popup
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={MessageSquare} value={stats.total} label="Total Popups" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.active} label="Active" tone="green" />
          <StatCard icon={Eye} value={stats.impressions} label="Impressions" tone="gold" />
          <StatCard icon={Send} value={stats.submissions} label="Submissions" tone="royal" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={popups}
          columns={columns}
          getRowId={(p) => p.id}
          loading={loading}
          searchPlaceholder="Search popups…"
          emptyTitle="No popups yet"
          emptyMessage="Create your first storefront popup."
          onRefresh={load}
          onRowClick={(p) => router.push(`/admin/popups/${p.id}/edit`)}
          rowActions={(p) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/popups/${p.id}/edit`) },
                { label: p.enabled ? "Pause" : "Activate", icon: CheckCircle2, onClick: () => toggleEnabled(p) },
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
        title="Delete popup?"
        message={`"${toDelete?.name}" will stop showing on the storefront.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
