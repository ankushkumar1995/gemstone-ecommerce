"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IndianRupee,
  Clock,
  RotateCcw,
  TrendingUp,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import type { PaymentsReport, PaymentTransaction } from "@/modules/payments";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  Card,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  Donut,
  Badge,
  ActionMenu,
  useAdminToast,
  type Column,
} from "../../_components";

const DONUT_COLORS = ["#c9942a", "#6a2ee0", "#2563eb", "#059669", "#e11d48"];
const METHOD_LABEL: Record<string, string> = {
  cod: "COD",
  card: "Card",
  upi: "UPI",
  netbanking: "Net Banking",
  manual: "Manual",
};

function payTone(s: string): "green" | "gold" | "muted" {
  return s === "paid" ? "green" : s === "unpaid" ? "gold" : "muted";
}

export function PaymentsView() {
  useAdminToast();
  const router = useRouter();
  const [report, setReport] = useState<PaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await adminApi.payments.report();
    if (res.ok) setReport(res.data);
    setLoading(false);
  };

  useOnMount(load);

  const donut = useMemo(
    () =>
      (report?.summary.byMethod ?? []).map((m, i) => ({
        label: METHOD_LABEL[m.method] ?? m.method,
        value: m.amount,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [report]
  );

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Date", "Type", "Order", "Customer", "Method", "Status", "Amount"],
      ...report.transactions.map((t) => [
        new Date(t.at).toLocaleDateString(),
        t.kind,
        t.orderNumber,
        t.customerName,
        t.method,
        t.status,
        String(t.kind === "refund" ? -t.amount : t.amount),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<PaymentTransaction>[] = [
    {
      key: "orderNumber",
      header: "Transaction",
      searchable: true,
      sortable: true,
      accessor: (t) => t.orderNumber,
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: t.kind === "refund" ? "rgba(225,29,72,0.1)" : "rgba(5,150,105,0.1)",
              color: t.kind === "refund" ? "#e11d48" : "#059669",
            }}
          >
            {t.kind === "refund" ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
          </span>
          <div>
            <p className="font-semibold" style={{ color: "var(--a-fg)" }}>{t.orderNumber}</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>
              {t.kind === "refund" ? `Refund · ${t.reference}` : "Charge"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      searchable: true,
      accessor: (t) => t.customerName,
      cell: (t) => <span className="text-sm" style={{ color: "var(--a-fg)" }}>{t.customerName}</span>,
    },
    {
      key: "method",
      header: "Method",
      filterable: true,
      filterOptions: Object.keys(METHOD_LABEL),
      accessor: (t) => t.method,
      cell: (t) => <Badge tone="muted">{METHOD_LABEL[t.method] ?? t.method}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      filterable: true,
      filterOptions: ["paid", "unpaid", "refunded"],
      accessor: (t) => t.status,
      cell: (t) => <StatusPill tone={payTone(t.status)}>{t.status}</StatusPill>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      accessor: (t) => t.amount,
      cell: (t) => (
        <span className="font-semibold" style={{ color: t.kind === "refund" ? "#e11d48" : "var(--a-fg)" }}>
          {t.kind === "refund" ? "− " : ""}{formatPrice(t.amount)}
        </span>
      ),
    },
    {
      key: "at",
      header: "Date",
      sortable: true,
      align: "right",
      accessor: (t) => t.at,
      cell: (t) => <span className="text-sm" style={{ color: "var(--a-muted)" }}>{new Date(t.at).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="All charges and refunds across your orders." />

      {loading || !report ? (
        <StatsSkeleton count={4} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={IndianRupee} value={formatPrice(report.summary.received)} label="Received" tone="green" />
            <StatCard icon={Clock} value={formatPrice(report.summary.pending)} label="Pending" tone="gold" />
            <StatCard icon={RotateCcw} value={formatPrice(report.summary.refunded)} label="Refunded" tone="rose" />
            <StatCard icon={TrendingUp} value={formatPrice(report.summary.net)} label="Net Revenue" tone="royal" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
            {/* transactions */}
            <div className="order-2 lg:order-1">
              <DataTable
                data={report.transactions}
                columns={columns}
                getRowId={(t) => t.id}
                loading={loading}
                searchPlaceholder="Search by order or customer…"
                emptyTitle="No transactions yet"
                emptyMessage="Charges and refunds will appear here."
                onRefresh={load}
                onRowClick={(t) => router.push(`/admin/orders/${t.orderId}`)}
                rowActions={(t) => (
                  <ActionMenu
                    actions={[{ label: "View order", icon: Eye, onClick: () => router.push(`/admin/orders/${t.orderId}`) }]}
                  />
                )}
              />
              <div className="mt-3">
                <button
                  onClick={exportCsv}
                  className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-black/[0.04]"
                  style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* side: method breakdown + COD */}
            <div className="order-1 space-y-6 lg:order-2">
              <Card>
                <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Received by method</h2>
                {donut.length > 0 ? (
                  <Donut segments={donut} />
                ) : (
                  <p className="text-sm" style={{ color: "var(--a-faint)" }}>No payments received yet.</p>
                )}
              </Card>
              <Card>
                <div className="flex items-center gap-2">
                  <Truck size={16} className="text-[var(--a-gold)]" />
                  <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>COD to collect</h2>
                </div>
                <p className="mt-2 text-2xl font-bold" style={{ color: "var(--a-fg)" }}>
                  {formatPrice(report.summary.codPending)}
                </p>
                <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                  Cash to be collected on delivery
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
