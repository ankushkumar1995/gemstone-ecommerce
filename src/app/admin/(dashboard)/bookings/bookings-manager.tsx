"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock, CheckCircle2, IndianRupee, Eye, ArrowRight } from "lucide-react";
import type { Booking } from "@/modules/bookings";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  Avatar,
  useAdminToast,
  useOnMount,
  type Column,
} from "../../_components";
import { B_STATUS_META, B_PAYMENT_META, B_NEXT_STATUSES } from "./booking-status";

function bookingDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function BookingsManager() {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.bookings.list();
    if (res.ok) setBookings(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const open = bookings.filter((b) => ["pending", "confirmed", "in_progress"].includes(b.status));
    const revenue = bookings.filter((b) => b.paymentStatus === "paid").reduce((s, b) => s + b.amount, 0);
    const completed = bookings.filter((b) => b.status === "completed").length;
    return { total: bookings.length, open: open.length, revenue, completed };
  }, [bookings]);

  const changeStatus = async (b: Booking, status: Booking["status"]) => {
    const res = await adminApi.bookings.updateStatus(b.id, status);
    if (res.ok) {
      toast(`Booking ${b.bookingNumber} → ${status}`, "success");
      setBookings((prev) => prev.map((x) => (x.id === b.id ? res.data : x)));
    } else toast(res.message, "error");
  };

  const columns: Column<Booking>[] = [
    {
      key: "bookingNumber",
      header: "Booking",
      searchable: true,
      sortable: true,
      accessor: (b) => b.bookingNumber,
      cell: (b) => (
        <div>
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{b.bookingNumber}</p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>{bookingDate(b.placedAt)}</p>
        </div>
      ),
    },
    {
      key: "service",
      header: "Service",
      searchable: true,
      accessor: (b) => b.serviceTitle,
      cell: (b) => (
        <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{b.serviceTitle}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      searchable: true,
      accessor: (b) => b.customer.name,
      cell: (b) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={b.customer.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{b.customer.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{b.intake?.phone || b.customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(B_STATUS_META),
      accessor: (b) => b.status,
      cell: (b) => <StatusPill tone={B_STATUS_META[b.status].tone}>{B_STATUS_META[b.status].label}</StatusPill>,
    },
    {
      key: "paymentStatus",
      header: "Payment",
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(B_PAYMENT_META),
      accessor: (b) => b.paymentStatus,
      cell: (b) => <StatusPill tone={B_PAYMENT_META[b.paymentStatus].tone}>{B_PAYMENT_META[b.paymentStatus].label}</StatusPill>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      accessor: (b) => b.amount,
      cell: (b) => <span className="font-semibold" style={{ color: "var(--a-fg)" }}>{formatPrice(b.amount)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Service Bookings"
        subtitle="Every consultation booking — intake details, status, payment and schedule."
      />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={CalendarClock} value={stats.total} label="Total Bookings" tone="royal" />
          <StatCard icon={Clock} value={stats.open} label="Active" tone="gold" />
          <StatCard icon={CheckCircle2} value={stats.completed} label="Completed" tone="green" />
          <StatCard icon={IndianRupee} value={formatPrice(stats.revenue)} label="Paid Revenue" tone="blue" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={bookings}
          columns={columns}
          getRowId={(b) => b.id}
          loading={loading}
          searchPlaceholder="Search by booking #, service or customer…"
          emptyTitle="No bookings yet"
          emptyMessage="Service bookings will appear here as customers book consultations."
          onRefresh={load}
          exportName="bookings"
          onRowClick={(b) => router.push(`/admin/bookings/${b.id}`)}
          rowActions={(b) => {
            const nexts = B_NEXT_STATUSES[b.status];
            return (
              <ActionMenu
                actions={[
                  { label: "View booking", icon: Eye, onClick: () => router.push(`/admin/bookings/${b.id}`) },
                  ...nexts.map((s) => ({
                    label: `Mark ${B_STATUS_META[s].label}`,
                    icon: ArrowRight,
                    onClick: () => changeStatus(b, s),
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
