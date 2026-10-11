"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, GalleryHorizontalEnd, CheckCircle2, Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Banner } from "@/modules/banners";
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
import { BannerFormModal } from "./banner-form-modal";

export function BannersManager() {
  const { toast } = useAdminToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Banner | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.banners.list();
    if (res.ok) setBanners(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = banners.length;
    const active = banners.filter((b) => b.active).length;
    const placements = new Set(banners.map((b) => b.placement)).size;
    return { total, active, placements };
  }, [banners]);

  const openEditor = (b: Banner | null) => {
    setEditing(b);
    setFormOpen(true);
  };

  const toggleActive = async (b: Banner) => {
    const res = await adminApi.banners.update(b.id, { active: !b.active });
    if (res.ok) {
      setBanners((prev) => prev.map((x) => (x.id === b.id ? res.data : x)));
      toast(res.data.active ? "Banner activated" : "Banner paused", "success");
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.banners.remove(toDelete.id);
    if (res.ok) {
      toast("Banner deleted", "success");
      setBanners((prev) => prev.filter((x) => x.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const columns: Column<Banner>[] = [
    {
      key: "title",
      header: "Banner",
      searchable: true,
      sortable: true,
      accessor: (b) => b.title,
      cell: (b) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
            {b.image && <Image src={b.image} alt={b.title} fill sizes="64px" className="object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{b.title}</p>
            {b.eyebrow && <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{b.eyebrow}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "placement",
      header: "Placement",
      sortable: true,
      filterable: true,
      filterOptions: ["hero", "promo", "strip"],
      accessor: (b) => b.placement,
      cell: (b) => <Badge tone="royal">{b.placement}</Badge>,
    },
    {
      key: "order",
      header: "Order",
      sortable: true,
      align: "right",
      accessor: (b) => b.order,
      cell: (b) => <span style={{ color: "var(--a-muted)" }}>{b.order}</span>,
    },
    {
      key: "active",
      header: "Status",
      filterable: true,
      filterOptions: ["Active", "Paused"],
      accessor: (b) => (b.active ? "Active" : "Paused"),
      cell: (b) => (b.active ? <StatusPill tone="green">Active</StatusPill> : <StatusPill tone="gold">Paused</StatusPill>),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Banners"
        subtitle="Manage homepage hero & promo banners shown on the storefront."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <Plus size={16} /> New Banner
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={GalleryHorizontalEnd} value={stats.total} label="Total Banners" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.active} label="Active" tone="green" />
          <StatCard icon={GalleryHorizontalEnd} value={stats.placements} label="Placements Used" tone="gold" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={banners}
          columns={columns}
          getRowId={(b) => b.id}
          loading={loading}
          searchPlaceholder="Search banners…"
          emptyTitle="No banners yet"
          emptyMessage="Create your first homepage banner."
          onRefresh={load}
          onRowClick={(b) => openEditor(b)}
          rowActions={(b) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => openEditor(b) },
                { label: b.active ? "Pause" : "Activate", icon: CheckCircle2, onClick: () => toggleActive(b) },
                ...(b.ctaHref ? [{ label: "Open link", icon: ExternalLink, onClick: () => window.open(b.ctaHref, "_blank") }] : []),
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(b) },
              ]}
            />
          )}
        />
      </div>

      <BannerFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(b, isNew) => {
          setBanners((prev) => (isNew ? [b, ...prev] : prev.map((x) => (x.id === b.id ? b : x))));
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete banner?"
        message={`"${toDelete?.title}" will be removed from the storefront.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
