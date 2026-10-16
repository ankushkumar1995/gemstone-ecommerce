"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ShoppingCart,
  IndianRupee,
  Clock,
  CheckCircle2,
  Eye,
  ArrowRight,
} from "lucide-react";
import type { Order } from "@/modules/orders";
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
  Avatar,
  useAdminToast,
  type Column,
} from "../../_components";
import { STATUS_META, PAYMENT_META, NEXT_STATUSES } from "./order-status";

function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function OrdersManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.orders.list();
    if (res.ok) setOrders(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const open = orders.filter((o) => ["pending", "confirmed", "packed", "shipped"].includes(o.status));
    const revenue = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((s, o) => s + o.pricing.grandTotal, 0);
    const delivered = orders.filter((o) => o.status === "delivered").length;
    return { total: orders.length, open: open.length, revenue, delivered };
  }, [orders]);

  const changeStatus = async (o: Order, status: Order["status"]) => {
    const res = await adminApi.orders.updateStatus(o.id, status);
    if (res.ok) {
      toast(`Order ${o.orderNumber} → ${status}`, "success");
      setOrders((prev) => prev.map((x) => (x.id === o.id ? res.data : x)));
    } else toast(res.message, "error");
  };

  const columns: Column<Order>[] = [
    {
      key: "orderNumber",
      header: "Order",
      searchable: true,
      sortable: true,
      accessor: (o) => o.orderNumber,
      cell: (o) => (
        <div>
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{o.orderNumber}</p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>
            {o.items.length} item{o.items.length !== 1 ? "s" : ""} · {orderDate(o.placedAt)}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      searchable: true,
      accessor: (o) => o.customer.name,
      cell: (o) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={o.customer.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{o.customer.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{o.customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(STATUS_META),
      accessor: (o) => o.status,
      cell: (o) => <StatusPill tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</StatusPill>,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(PAYMENT_META),
      accessor: (o) => o.paymentStatus,
      cell: (o) => <StatusPill tone={PAYMENT_META[o.paymentStatus].tone}>{PAYMENT_META[o.paymentStatus].label}</StatusPill>,
    },
    {
      key: "grandTotal",
      header: "Total",
      sortable: true,
      align: "right",
      accessor: (o) => o.pricing.grandTotal,
      cell: (o) => (
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          {formatPrice(o.pricing.grandTotal)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Every order, its status, payment and fulfillment."
        action={
          <AdminButton onClick={() => router.push("/admin/orders/new")}>
            <Plus size={16} /> Create Order
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ShoppingCart} value={stats.total} label="Total Orders" tone="royal" />
          <StatCard icon={Clock} value={stats.open} label="Open Orders" tone="gold" />
          <StatCard icon={CheckCircle2} value={stats.delivered} label="Delivered" tone="green" />
          <StatCard icon={IndianRupee} value={formatPrice(stats.revenue)} label="Paid Revenue" tone="blue" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={orders}
          columns={columns}
          getRowId={(o) => o.id}
          loading={loading}
          searchPlaceholder="Search by order # or customer…"
          emptyTitle="No orders yet"
          emptyMessage="Orders will appear here as customers check out."
          onRefresh={load}
          exportName="orders"
          onRowClick={(o) => router.push(`/admin/orders/${o.id}`)}
          rowActions={(o) => {
            const nexts = NEXT_STATUSES[o.status];
            return (
              <ActionMenu
                actions={[
                  { label: "View order", icon: Eye, onClick: () => router.push(`/admin/orders/${o.id}`) },
                  ...nexts.map((s) => ({
                    label: `Mark ${STATUS_META[s].label}`,
                    icon: ArrowRight,
                    onClick: () => changeStatus(o, s),
                    danger: s === "cancelled" || s === "refunded",
                  })),
                ]}
              />
            );
          }}
        />
      </div>
    </div>
  );
}
