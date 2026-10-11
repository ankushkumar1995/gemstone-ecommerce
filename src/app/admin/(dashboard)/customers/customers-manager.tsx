"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Users,
  Crown,
  Ban,
  IndianRupee,
  Eye,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import type { Customer } from "@/modules/customers";
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
  Badge,
  Avatar,
  useAdminToast,
  type Column,
} from "../../_components";
import { CustomerFormModal } from "./customer-form-modal";

function statusTone(s: Customer["status"]): "green" | "gold" | "rose" {
  return s === "vip" ? "gold" : s === "blocked" ? "rose" : "green";
}

function relativeDate(iso?: string): string {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return new Date(iso).toLocaleDateString();
}

export function CustomersManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.customers.list();
    if (res.ok) setCustomers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = customers.length;
    const vip = customers.filter((c) => c.status === "vip").length;
    const blocked = customers.filter((c) => c.status === "blocked").length;
    const revenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    return { total, vip, blocked, revenue };
  }, [customers]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.customers.remove(toDelete.id);
    if (res.ok) {
      toast("Customer deleted", "success");
      setCustomers((prev) => prev.filter((c) => c.id !== toDelete.id));
    } else toast(res.message, "error");
  };

  const bulkStatus = async (ids: string[], status: Customer["status"], clear: () => void) => {
    await Promise.all(ids.map((id) => adminApi.customers.update(id, { status })));
    toast(`${ids.length} customers updated`, "success");
    clear();
    load();
  };

  const columns: Column<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      searchable: true,
      sortable: true,
      accessor: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} src={c.avatar} size={38} />
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>
              {c.name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
              {c.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["active", "vip", "blocked"],
      accessor: (c) => c.status,
      cell: (c) => <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>,
    },
    {
      key: "totalOrders",
      header: "Orders",
      sortable: true,
      align: "right",
      accessor: (c) => c.totalOrders,
      cell: (c) => <span style={{ color: "var(--a-fg)" }}>{c.totalOrders}</span>,
    },
    {
      key: "totalSpent",
      header: "Lifetime value",
      sortable: true,
      align: "right",
      accessor: (c) => c.totalSpent,
      cell: (c) => (
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          {formatPrice(c.totalSpent)}
        </span>
      ),
    },
    {
      key: "lastOrderAt",
      header: "Last order",
      sortable: true,
      align: "right",
      accessor: (c) => c.lastOrderAt ?? "",
      cell: (c) => (
        <span className="text-sm" style={{ color: "var(--a-muted)" }}>
          {relativeDate(c.lastOrderAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Your registered shoppers, their orders and lifetime value."
        action={
          <AdminButton onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Add Customer
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} value={stats.total} label="Total Customers" tone="royal" />
          <StatCard icon={Crown} value={stats.vip} label="VIP" tone="gold" />
          <StatCard icon={Ban} value={stats.blocked} label="Blocked" tone="rose" />
          <StatCard icon={IndianRupee} value={formatPrice(stats.revenue)} label="Lifetime Revenue" tone="green" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={customers}
          columns={columns}
          getRowId={(c) => c.id}
          loading={loading}
          searchPlaceholder="Search customers…"
          emptyTitle="No customers yet"
          emptyMessage="Add your first customer to get started."
          onRefresh={load}
          exportName="customers"
          onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
          renderGridItem={(c) => (
            <CustomerCard customer={c} onOpen={() => router.push(`/admin/customers/${c.id}`)} />
          )}
          bulkActions={(ids, clear) => (
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton variant="outline" onClick={() => bulkStatus(ids, "vip", clear)}>
                <Crown size={15} /> Mark VIP
              </AdminButton>
              <AdminButton variant="outline" onClick={() => bulkStatus(ids, "active", clear)}>
                <ShieldCheck size={15} /> Mark active
              </AdminButton>
              <AdminButton variant="outline" onClick={() => bulkStatus(ids, "blocked", clear)}>
                <Ban size={15} /> Block
              </AdminButton>
            </div>
          )}
          rowActions={(c) => (
            <ActionMenu
              actions={[
                { label: "View profile", icon: Eye, onClick: () => router.push(`/admin/customers/${c.id}`) },
                { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/customers/${c.id}?edit=1`) },
                { label: "Delete", icon: Trash2, danger: true, onClick: () => setToDelete(c) },
              ]}
            />
          )}
        />
      </div>

      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(c) => {
          setCustomers((prev) => [c, ...prev]);
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete customer?"
        message={`"${toDelete?.name}" and their profile will be permanently removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function CustomerCard({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  const c = customer;
  return (
    <button
      onClick={onOpen}
      className="group block w-full rounded-lg border p-4 text-left transition-colors hover:border-[var(--a-border-strong)]"
      style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={c.name} src={c.avatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" style={{ color: "var(--a-fg)" }}>
            {c.name}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
            {c.email}
          </p>
        </div>
        <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5" style={{ background: "var(--a-surface-2)" }}>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Orders</p>
          <p className="text-base font-semibold" style={{ color: "var(--a-fg)" }}>{c.totalOrders}</p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--a-surface-2)" }}>
          <p className="text-xs" style={{ color: "var(--a-muted)" }}>Lifetime</p>
          <p className="text-base font-semibold" style={{ color: "var(--a-fg)" }}>{formatPrice(c.totalSpent)}</p>
        </div>
      </div>
      {c.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.slice(0, 3).map((t) => (
            <Badge key={t} tone="muted">{t}</Badge>
          ))}
        </div>
      )}
    </button>
  );
}
