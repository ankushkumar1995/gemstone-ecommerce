/**
 * Reports domain — types. Read-only analytics aggregated from orders +
 * products. No storage of its own; everything is derived on demand.
 */

export interface ReportSummary {
  revenue: number; // revenue from non-cancelled/refunded orders
  paidRevenue: number; // revenue from paid orders only
  orders: number; // count of counted orders
  avgOrderValue: number;
  itemsSold: number;
  uniqueCustomers: number;
}

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  image?: string;
  qtySold: number;
  revenue: number;
}

export interface CategoryRevenue {
  category: string;
  revenue: number;
  qty: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface SalesReport {
  range: { from: string; to: string };
  summary: ReportSummary;
  revenueByDay: RevenuePoint[];
  topProducts: TopProduct[];
  revenueByCategory: CategoryRevenue[];
  statusBreakdown: StatusCount[];
}
