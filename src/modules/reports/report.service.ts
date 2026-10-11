/**
 * Reports domain — service. Aggregates orders + products into a sales report
 * for a given date range. Revenue excludes cancelled/refunded orders.
 */

import { ok, type Result } from "@/core/result";
import { orderService } from "@/modules/orders";
import { productService } from "@/modules/products";
import type {
  SalesReport,
  RevenuePoint,
  TopProduct,
  CategoryRevenue,
  StatusCount,
} from "./report.types";

const EXCLUDED_FROM_REVENUE = new Set(["cancelled", "refunded"]);

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Build the full inclusive list of day keys between two dates. */
function dayRange(from: Date, to: Date): string[] {
  const days: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export const reportService = {
  /**
   * @param fromIso inclusive start (ISO). Defaults to 30 days ago.
   * @param toIso   inclusive end (ISO). Defaults to now.
   */
  async sales(fromIso?: string, toIso?: string): Promise<Result<SalesReport>> {
    const to = toIso ? new Date(toIso) : new Date();
    const from = fromIso ? new Date(fromIso) : new Date(to.getTime() - 29 * 86400000);

    const [ordersRes, productsRes] = await Promise.all([
      orderService.list(),
      productService.list(),
    ]);
    const orders = ordersRes.ok ? ordersRes.value : [];
    const products = productsRes.ok ? productsRes.value : [];

    // productId → category map (for revenue-by-category)
    const categoryOf = new Map<string, string>();
    for (const p of products) categoryOf.set(p.id, p.category);

    // filter orders into the window
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    const inWindow = orders.filter((o) => {
      const t = new Date(o.placedAt).getTime();
      return t >= fromMs && t <= toMs;
    });

    // counted = revenue-eligible orders
    const counted = inWindow.filter((o) => !EXCLUDED_FROM_REVENUE.has(o.status));

    // ---- summary ----
    const revenue = counted.reduce((s, o) => s + o.pricing.grandTotal, 0);
    const paidRevenue = counted
      .filter((o) => o.paymentStatus === "paid")
      .reduce((s, o) => s + o.pricing.grandTotal, 0);
    const itemsSold = counted.reduce((s, o) => s + o.items.reduce((n, it) => n + it.qty, 0), 0);
    const uniqueCustomers = new Set(counted.map((o) => o.customerId || o.customer.email)).size;
    const summary = {
      revenue,
      paidRevenue,
      orders: counted.length,
      avgOrderValue: counted.length ? Math.round(revenue / counted.length) : 0,
      itemsSold,
      uniqueCustomers,
    };

    // ---- revenue by day (zero-filled across the range) ----
    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (const key of dayRange(from, to)) byDay.set(key, { revenue: 0, orders: 0 });
    for (const o of counted) {
      const key = dayKey(o.placedAt);
      const cur = byDay.get(key);
      if (cur) {
        cur.revenue += o.pricing.grandTotal;
        cur.orders += 1;
      }
    }
    const revenueByDay: RevenuePoint[] = [...byDay.entries()].map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
    }));

    // ---- top products + revenue by category ----
    const prodAgg = new Map<string, TopProduct>();
    const catAgg = new Map<string, CategoryRevenue>();
    for (const o of counted) {
      for (const it of o.items) {
        // top products
        const tp = prodAgg.get(it.productId) ?? {
          productId: it.productId,
          name: it.name,
          image: it.image,
          qtySold: 0,
          revenue: 0,
        };
        tp.qtySold += it.qty;
        tp.revenue += it.lineTotal;
        prodAgg.set(it.productId, tp);

        // category
        const cat = categoryOf.get(it.productId) ?? "other";
        const ca = catAgg.get(cat) ?? { category: cat, revenue: 0, qty: 0 };
        ca.revenue += it.lineTotal;
        ca.qty += it.qty;
        catAgg.set(cat, ca);
      }
    }
    const topProducts = [...prodAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const revenueByCategory = [...catAgg.values()].sort((a, b) => b.revenue - a.revenue);

    // ---- status breakdown (all in-window orders) ----
    const statusAgg = new Map<string, number>();
    for (const o of inWindow) statusAgg.set(o.status, (statusAgg.get(o.status) ?? 0) + 1);
    const statusBreakdown: StatusCount[] = [...statusAgg.entries()].map(([status, count]) => ({
      status,
      count,
    }));

    return ok({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary,
      revenueByDay,
      topProducts,
      revenueByCategory,
      statusBreakdown,
    } satisfies SalesReport);
  },
};
