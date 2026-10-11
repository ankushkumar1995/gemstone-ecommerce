"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { IndianRupee, ShoppingCart, TrendingUp, Users, Download } from "lucide-react";
import type { SalesReport } from "@/modules/reports";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  PageHeader,
  Card,
  StatCard,
  StatsSkeleton,
  LineChart,
  Donut,
  SegmentedControl,
  Badge,
  AdminButton,
  EmptyState,
} from "../../_components";

type RangeKey = "7d" | "30d" | "90d" | "year";

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, year: 365 };

const DONUT_COLORS = ["#c9942a", "#6a2ee0", "#2563eb", "#059669", "#e11d48", "#9169ff"];

function statusTone(s: string): "muted" | "gold" | "green" | "blue" | "rose" {
  if (s === "delivered") return "green";
  if (s === "pending") return "gold";
  if (s === "cancelled" || s === "refunded") return "rose";
  if (s === "confirmed" || s === "packed" || s === "shipped") return "blue";
  return "muted";
}

export function ReportsView() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - (RANGE_DAYS[r] - 1) * 86400000);
    const res = await adminApi.reports.sales(from.toISOString(), to.toISOString());
    if (res.ok) setReport(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const donutSegments = useMemo(
    () =>
      (report?.revenueByCategory ?? []).map((c, i) => ({
        label: c.category,
        value: c.revenue,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      })),
    [report]
  );

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Date", "Revenue", "Orders"],
      ...report.revenueByDay.map((d) => [d.date, String(d.revenue), String(d.orders)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Sales performance, best sellers and revenue breakdown."
        action={
          <div className="flex items-center gap-2">
            <SegmentedControl
              value={range}
              onChange={(v) => setRange(v as RangeKey)}
              options={[
                { value: "7d", label: "7d" },
                { value: "30d", label: "30d" },
                { value: "90d", label: "90d" },
                { value: "year", label: "1y" },
              ]}
            />
            <AdminButton variant="outline" onClick={exportCsv} disabled={!report}>
              <Download size={15} /> Export
            </AdminButton>
          </div>
        }
      />

      {loading || !report ? (
        <StatsSkeleton count={4} />
      ) : (
        <>
          {/* summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={IndianRupee} value={formatPrice(report.summary.revenue)} label="Revenue" tone="green" />
            <StatCard icon={ShoppingCart} value={report.summary.orders} label="Orders" tone="royal" />
            <StatCard icon={TrendingUp} value={formatPrice(report.summary.avgOrderValue)} label="Avg Order Value" tone="gold" />
            <StatCard icon={Users} value={report.summary.uniqueCustomers} label="Customers" tone="blue" />
          </div>

          {/* revenue trend */}
          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Revenue trend</h2>
                <p className="text-sm" style={{ color: "var(--a-muted)" }}>
                  {formatPrice(report.summary.paidRevenue)} paid · {report.summary.itemsSold} items sold
                </p>
              </div>
            </div>
            {report.revenueByDay.some((d) => d.revenue > 0) ? (
              <LineChart data={report.revenueByDay.map((d) => d.revenue)} height={200} />
            ) : (
              <div className="py-16">
                <EmptyState title="No sales in this period" message="Revenue will chart here once orders come in." />
              </div>
            )}
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
            {/* top products */}
            <Card>
              <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Best sellers</h2>
              {report.topProducts.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--a-faint)" }}>No sales yet.</p>
              ) : (
                <div className="space-y-2">
                  {report.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: "var(--a-border)" }}>
                      <span className="w-5 text-center text-sm font-bold" style={{ color: "var(--a-faint)" }}>{i + 1}</span>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
                        {p.image && <Image src={p.image} alt={p.name} fill sizes="40px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "var(--a-faint)" }}>{p.qtySold} sold</p>
                      </div>
                      <span className="font-semibold" style={{ color: "var(--a-fg)" }}>{formatPrice(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* category + status */}
            <div className="space-y-6">
              <Card>
                <h2 className="mb-4 font-semibold" style={{ color: "var(--a-fg)" }}>Revenue by category</h2>
                {donutSegments.length > 0 ? (
                  <Donut segments={donutSegments} />
                ) : (
                  <p className="text-sm" style={{ color: "var(--a-faint)" }}>No data yet.</p>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Orders by status</h2>
                {report.statusBreakdown.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--a-faint)" }}>No orders in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {report.statusBreakdown.map((s) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                        <span className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
