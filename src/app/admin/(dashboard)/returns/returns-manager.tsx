"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Clock, CheckCircle2, IndianRupee, Eye } from "lucide-react";
import type { ReturnRequest } from "@/modules/returns";
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
  Badge,
  useAdminToast,
  type Column,
} from "../../_components";
import { RETURN_STATUS_META, REASON_LABELS } from "./return-status";

export function ReturnsManager() {
  useAdminToast();
  const router = useRouter();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.returns.list();
    if (res.ok) setReturns(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = returns.length;
    const open = returns.filter((r) => ["requested", "approved", "received"].includes(r.status)).length;
    const refunded = returns.filter((r) => r.status === "refunded").length;
    const refundValue = returns
      .filter((r) => r.status === "refunded")
      .reduce((s, r) => s + (r.refundAmount ?? 0), 0);
    return { total, open, refunded, refundValue };
  }, [returns]);

  const columns: Column<ReturnRequest>[] = [
    {
      key: "returnNumber",
      header: "Return",
      searchable: true,
      sortable: true,
      accessor: (r) => r.returnNumber,
      cell: (r) => (
        <div>
          <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{r.returnNumber}</p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>for {r.orderNumber}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      searchable: true,
      accessor: (r) => r.customer.name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.customer.name} size={30} />
          <span className="truncate text-sm" style={{ color: "var(--a-fg)" }}>{r.customer.name}</span>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      filterable: true,
      filterOptions: Object.values(REASON_LABELS),
      accessor: (r) => REASON_LABELS[r.reason],
      cell: (r) => <Badge tone="muted">{REASON_LABELS[r.reason]}</Badge>,
    },
    {
      key: "amount",
      header: "Refund",
      sortable: true,
      align: "right",
      accessor: (r) => r.refundAmount ?? r.suggestedRefund,
      cell: (r) => (
        <span className="font-semibold" style={{ color: "var(--a-fg)" }}>
          {formatPrice(r.refundAmount ?? r.suggestedRefund)}
          {r.refundAmount === undefined && <span className="ml-1 text-xs font-normal" style={{ color: "var(--a-faint)" }}>(est)</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(RETURN_STATUS_META),
      accessor: (r) => r.status,
      cell: (r) => <StatusPill tone={RETURN_STATUS_META[r.status].tone}>{RETURN_STATUS_META[r.status].label}</StatusPill>,
    },
  ];

  return (
    <div>
      <PageHeader title="Returns" subtitle="Review return requests, approve, receive and refund." />

      {loading ? (
        <StatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={RotateCcw} value={stats.total} label="Total Returns" tone="royal" />
          <StatCard icon={Clock} value={stats.open} label="Open" tone="gold" />
          <StatCard icon={CheckCircle2} value={stats.refunded} label="Refunded" tone="green" />
          <StatCard icon={IndianRupee} value={formatPrice(stats.refundValue)} label="Refunded Value" tone="rose" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={returns}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          searchPlaceholder="Search returns…"
          emptyTitle="No returns yet"
          emptyMessage="Return requests will appear here."
          onRefresh={load}
          exportName="returns"
          onRowClick={(r) => router.push(`/admin/returns/${r.id}`)}
          rowActions={(r) => (
            <ActionMenu
              actions={[{ label: "View return", icon: Eye, onClick: () => router.push(`/admin/returns/${r.id}`) }]}
            />
          )}
        />
      </div>
    </div>
  );
}
