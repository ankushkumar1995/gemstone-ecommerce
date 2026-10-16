"use client";

import { useEffect, useMemo, useState } from "react";
import { TicketPercent, CheckCircle2, Clock, Zap, Plus, Pencil, Trash2, Copy, Check } from "lucide-react";
import type { Coupon } from "@/modules/coupons";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
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
import { CouponFormModal } from "./coupon-form-modal";

function isExpired(c: Coupon) {
  return c.expiresAt ? new Date(c.expiresAt).getTime() < Date.now() : false;
}
function isLive(c: Coupon) {
  if (!c.active || isExpired(c)) return false;
  if (c.startsAt && new Date(c.startsAt).getTime() > Date.now()) return false;
  if (c.usageLimit && c.usageLimit > 0 && c.usedCount >= c.usageLimit) return false;
  return true;
}

export function CouponsManager() {
  const { toast } = useAdminToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.coupons.list();
    if (res.ok) setCoupons(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const total = coupons.length;
    const live = coupons.filter(isLive).length;
    const expired = coupons.filter(isExpired).length;
    const redemptions = coupons.reduce((s, c) => s + c.usedCount, 0);
    return { total, live, expired, redemptions };
  }, [coupons]);

  const openEditor = (c: Coupon | null) => {
    setEditing(c);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.coupons.remove(toDelete.id);
    if (res.ok) {
      toast("Coupon deleted", "success");
      setCoupons((prev) => prev.filter((c) => c.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const toggleActive = async (c: Coupon) => {
    const res = await adminApi.coupons.toggle(c.id, !c.active);
    if (res.ok) {
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? res.data : x)));
      toast(res.data.active ? "Coupon activated" : "Coupon paused", "success");
    } else toast(res.message, "error");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const columns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      searchable: true,
      sortable: true,
      accessor: (c) => c.code,
      cell: (c) => (
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyCode(c.code);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-sm font-semibold transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            {c.code}
            {copiedCode === c.code ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} style={{ color: "var(--a-muted)" }} />}
          </button>
          {c.description && (
            <p className="mt-1 truncate text-xs" style={{ color: "var(--a-faint)" }}>{c.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "value",
      header: "Discount",
      sortable: true,
      accessor: (c) => c.value,
      cell: (c) => (
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          {c.type === "percentage" ? `${c.value}%` : formatPrice(c.value)}
          {c.type === "percentage" && c.maxDiscount ? (
            <span className="ml-1 text-xs font-normal" style={{ color: "var(--a-faint)" }}>
              (max {formatPrice(c.maxDiscount)})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "minCartValue",
      header: "Min cart",
      sortable: true,
      align: "right",
      accessor: (c) => c.minCartValue,
      cell: (c) => <span style={{ color: "var(--a-muted)" }}>{c.minCartValue ? formatPrice(c.minCartValue) : "—"}</span>,
    },
    {
      key: "usedCount",
      header: "Used",
      sortable: true,
      align: "right",
      accessor: (c) => c.usedCount,
      cell: (c) => (
        <span style={{ color: "var(--a-fg)" }}>
          {c.usedCount}
          {c.usageLimit && c.usageLimit > 0 ? <span style={{ color: "var(--a-faint)" }}> / {c.usageLimit}</span> : ""}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      filterable: true,
      filterOptions: ["Live", "Paused", "Expired"],
      accessor: (c) => (isExpired(c) ? "Expired" : isLive(c) ? "Live" : "Paused"),
      cell: (c) =>
        isExpired(c) ? (
          <StatusPill tone="muted">Expired</StatusPill>
        ) : isLive(c) ? (
          <StatusPill tone="green">Live</StatusPill>
        ) : (
          <StatusPill tone="gold">Paused</StatusPill>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Create promo codes customers apply at checkout."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <Plus size={16} /> New Coupon
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={TicketPercent} value={stats.total} label="Total Coupons" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.live} label="Live" tone="green" />
          <StatCard icon={Clock} value={stats.expired} label="Expired" tone="rose" />
          <StatCard icon={Zap} value={stats.redemptions} label="Redemptions" tone="gold" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={coupons}
          columns={columns}
          getRowId={(c) => c.id}
          loading={loading}
          searchPlaceholder="Search coupons…"
          emptyTitle="No coupons yet"
          emptyMessage="Create your first promo code."
          onRefresh={load}
          exportName="coupons"
          onRowClick={(c) => openEditor(c)}
          rowActions={(c) => (
            <ActionMenu
              actions={[
                { label: "Edit", icon: Pencil, onClick: () => openEditor(c) },
                { label: c.active ? "Pause" : "Activate", icon: c.active ? Clock : CheckCircle2, onClick: () => toggleActive(c) },
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(c) },
              ]}
            />
          )}
        />
      </div>

      <CouponFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(c, isNew) => {
          setCoupons((prev) => (isNew ? [c, ...prev] : prev.map((x) => (x.id === c.id ? c : x))));
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete coupon?"
        message={`"${toDelete?.code}" will be removed. Existing orders keep their discount.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
