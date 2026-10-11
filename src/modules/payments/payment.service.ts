/**
 * Payments domain — service. Builds a transactions ledger + summary by
 * deriving from orders (charges) and returns (refunds). Read-only; no storage.
 */

import { ok, type Result } from "@/core/result";
import { orderService } from "@/modules/orders";
import { returnService } from "@/modules/returns";
import type { PaymentMethod } from "@/modules/orders";
import type { PaymentTransaction, PaymentSummary, PaymentsReport } from "./payment.types";

const EXCLUDED = new Set(["cancelled"]); // cancelled orders aren't real charges

export const paymentService = {
  async report(filters?: {
    status?: string;
    method?: string;
    from?: string;
    to?: string;
    q?: string;
  }): Promise<Result<PaymentsReport>> {
    const [ordersRes, returnsRes] = await Promise.all([orderService.list(), returnService.list()]);
    const orders = ordersRes.ok ? ordersRes.value : [];
    const returns = returnsRes.ok ? returnsRes.value : [];

    const tx: PaymentTransaction[] = [];

    // charges — one per non-cancelled order
    for (const o of orders) {
      if (EXCLUDED.has(o.status)) continue;
      tx.push({
        id: `chg_${o.id}`,
        kind: "charge",
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        customerEmail: o.customer.email,
        method: o.paymentMethod,
        status: o.paymentStatus,
        amount: o.pricing.grandTotal,
        at: o.placedAt,
      });
    }

    // refunds — one per refunded return with an amount
    for (const r of returns) {
      if (r.status !== "refunded" || !r.refundAmount) continue;
      const order = orders.find((o) => o.id === r.orderId);
      tx.push({
        id: `rfd_${r.id}`,
        kind: "refund",
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        reference: r.returnNumber,
        customerName: r.customer.name,
        customerEmail: r.customer.email,
        method: order?.paymentMethod ?? "manual",
        status: "refunded",
        amount: r.refundAmount,
        at: r.updatedAt,
      });
    }

    // ---- summary (computed on the FULL ledger, before filtering) ----
    const charges = tx.filter((t) => t.kind === "charge");
    const refunds = tx.filter((t) => t.kind === "refund");
    const received = charges.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);
    const pending = charges.filter((t) => t.status === "unpaid").reduce((s, t) => s + t.amount, 0);
    const codPending = charges
      .filter((t) => t.status === "unpaid" && t.method === "cod")
      .reduce((s, t) => s + t.amount, 0);
    const refunded = refunds.reduce((s, t) => s + t.amount, 0);

    const methodMap = new Map<PaymentMethod, number>();
    for (const t of charges.filter((c) => c.status === "paid")) {
      methodMap.set(t.method, (methodMap.get(t.method) ?? 0) + t.amount);
    }
    const byMethod = [...methodMap.entries()].map(([method, amount]) => ({ method, amount }));

    const summary: PaymentSummary = {
      received,
      pending,
      refunded,
      net: received - refunded,
      codPending,
      byMethod,
    };

    // ---- filtered + sorted transaction list ----
    let list = [...tx].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    if (filters?.status) list = list.filter((t) => t.status === filters.status);
    if (filters?.method) list = list.filter((t) => t.method === filters.method);
    if (filters?.from) {
      const f = new Date(filters.from).setHours(0, 0, 0, 0);
      list = list.filter((t) => new Date(t.at).getTime() >= f);
    }
    if (filters?.to) {
      const to = new Date(filters.to).setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.at).getTime() <= to);
    }
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (t) =>
          t.orderNumber.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.customerEmail.toLowerCase().includes(q)
      );
    }

    return ok({ summary, transactions: list });
  },
};
