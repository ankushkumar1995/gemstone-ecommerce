"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, CheckCircle2, Star, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { AstroService } from "@/types";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  AdminButton,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  ConfirmDialog,
  useAdminToast,
  type Column,
} from "../../_components";
import { ServiceFormModal } from "./service-form-modal";

export function ServicesManager() {
  const { toast } = useAdminToast();
  const [services, setServices] = useState<AstroService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AstroService | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AstroService | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.services.list();
    if (res.ok) setServices(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = services.length;
    const active = services.filter((s) => s.status === "active").length;
    const popular = services.filter((s) => s.popular).length;
    return { total, active, popular };
  }, [services]);

  const openEditor = (s: AstroService | null) => {
    setEditing(s);
    setFormOpen(true);
  };

  const toggleActive = async (s: AstroService) => {
    const res = await adminApi.services.update(s.id, { status: s.status === "active" ? "inactive" : "active" });
    if (res.ok) {
      setServices((prev) => prev.map((x) => (x.id === s.id ? res.data : x)));
      toast(res.data.status === "active" ? "Service activated" : "Service hidden", "success");
    } else toast(res.message, "error");
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= services.length) return;
    const a = services[index];
    const b = services[j];
    const aOrder = a.order ?? index + 1;
    const bOrder = b.order ?? j + 1;
    const next = [...services];
    next[index] = { ...b, order: aOrder };
    next[j] = { ...a, order: bOrder };
    next.sort((x, y) => (x.order ?? 999) - (y.order ?? 999));
    setServices(next);
    await Promise.all([
      adminApi.services.update(a.id, { order: bOrder }),
      adminApi.services.update(b.id, { order: aOrder }),
    ]);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.services.remove(toDelete.id);
    if (res.ok) {
      toast("Service deleted", "success");
      setServices((prev) => prev.filter((s) => s.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const columns: Column<AstroService>[] = [
    {
      key: "title",
      header: "Service",
      searchable: true,
      sortable: true,
      accessor: (s) => s.title,
      cell: (s) => (
        <div>
          <p className="font-medium" style={{ color: "var(--a-fg)" }}>
            {s.title} {s.popular && <Star size={12} className="inline fill-amber-400 text-amber-400" />}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{s.tagline}</p>
        </div>
      ),
    },
    {
      key: "priceFrom",
      header: "Price",
      sortable: true,
      accessor: (s) => s.priceFrom,
      cell: (s) => (
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          {s.priceFrom === 0 ? "Free" : formatPrice(s.priceFrom)}
          <span className="ml-1 text-xs font-normal" style={{ color: "var(--a-faint)" }}>· {s.duration}</span>
        </span>
      ),
    },
    {
      key: "order",
      header: "Order",
      align: "right",
      accessor: (s) => s.order,
      cell: (s) => {
        const i = services.findIndex((x) => x.id === s.id);
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => reorder(i, -1)} disabled={i === 0} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05] disabled:opacity-30" style={{ color: "var(--a-muted)" }} aria-label="Up">
              <ArrowUp size={14} />
            </button>
            <button onClick={() => reorder(i, 1)} disabled={i === services.length - 1} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.05] disabled:opacity-30" style={{ color: "var(--a-muted)" }} aria-label="Down">
              <ArrowDown size={14} />
            </button>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["active", "inactive"],
      accessor: (s) => s.status,
      cell: (s) => <StatusPill tone={s.status === "active" ? "green" : "muted"}>{s.status}</StatusPill>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Astrology services shown on the storefront /services page."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <Plus size={16} /> New Service
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Sparkles} value={stats.total} label="Total Services" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.active} label="Active" tone="green" />
          <StatCard icon={Star} value={stats.popular} label="Popular" tone="gold" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={services}
          columns={columns}
          getRowId={(s) => s.id}
          loading={loading}
          searchPlaceholder="Search services…"
          emptyTitle="No services yet"
          emptyMessage="Create your first astrology service."
          onRefresh={load}
          onRowClick={(s) => openEditor(s)}
          rowActions={(s) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => openEditor(s) },
                { label: s.status === "active" ? "Hide" : "Activate", icon: CheckCircle2, onClick: () => toggleActive(s) },
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(s) },
              ]}
            />
          )}
        />
      </div>

      <ServiceFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(s, isNew) => {
          setServices((prev) =>
            (isNew ? [...prev, s] : prev.map((x) => (x.id === s.id ? s : x))).sort(
              (a, b) => (a.order ?? 999) - (b.order ?? 999)
            )
          );
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete service?"
        message={`"${toDelete?.title}" will be removed from the storefront.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
