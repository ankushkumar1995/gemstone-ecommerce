import "server-only";

/**
 * "My orders" (gemstones / samagri) for the signed-in customer, in a
 * customer-safe shape: no signatures, internal notes or admin activity text.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { getOrderRepository } from "./order.repository";
import { orderCancelPolicy, customerCancelOrder } from "./order-checkout.service";
import type { Order } from "./order.types";

export interface MyOrderStep { key: string; label: string; state: "done" | "current" | "upcoming" | "cancelled"; at: string | null }

export interface MyOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  /** online = paid / paying with Razorpay; cod = pay on delivery; other = by our team. */
  paymentMode: "online" | "cod" | "other";
  items: { productId: string; name: string; image: string | null; variantLabel: string | null; qty: number; unitPrice: number; lineTotal: number; extras: string[] }[];
  itemCount: number;
  pricing: { subtotal: number; discount: number; couponCode: string | null; shipping: number; tax: number; grandTotal: number };
  address: { name: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string };
  tracking: { courier: string; number: string; shippedAt: string | null; deliveredAt: string | null } | null;
  steps: MyOrderStep[];
  /** Pay-online and still unpaid: stock is held until this time. */
  holdUntil: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  refund: { amount: number; to: "source" | "wallet" | "team"; status: "processed" | "failed"; at: string } | null;
  cancelReason: string | null;
  actions: { cancel: { allowed: boolean; refundAmount: number; refundTo: ("source" | "wallet")[]; why: string } };
}

const lastAt = (o: Order, re: RegExp) => o.activity.find((a) => re.test(a.message))?.at ?? null;

function steps(o: Order): MyOrderStep[] {
  const flow: { key: string; label: string; status: Order["status"]; at: string | null }[] = [
    { key: "placed", label: "Order placed", status: "pending", at: o.placedAt },
    { key: "confirmed", label: o.paymentMethod === "cod" ? "Confirmed (pay on delivery)" : "Payment received", status: "confirmed", at: o.payment?.paidAt ?? lastAt(o, /to "confirmed"/) ?? (o.paymentMethod === "cod" && o.status !== "pending" ? o.placedAt : null) },
    { key: "packed", label: "Packed", status: "packed", at: lastAt(o, /to "packed"/) },
    { key: "shipped", label: "Shipped", status: "shipped", at: o.fulfillment.shippedAt ?? lastAt(o, /to "shipped"/) },
    { key: "delivered", label: "Delivered", status: "delivered", at: o.fulfillment.deliveredAt ?? lastAt(o, /to "delivered"/) },
  ];
  const order: Order["status"][] = ["pending", "confirmed", "packed", "shipped", "delivered"];
  if (o.status === "cancelled" || o.status === "refunded") {
    const kept = flow.filter((s) => s.at).map<MyOrderStep>((s) => ({ key: s.key, label: s.label, state: "done", at: s.at }));
    return [...kept, { key: "cancelled", label: o.status === "refunded" ? "Refunded" : "Cancelled", state: "cancelled", at: lastAt(o, /cancel|refund/i) ?? o.updatedAt }];
  }
  const reached = order.indexOf(o.status);
  let current = false;
  return flow.map((s) => {
    if (order.indexOf(s.status) <= reached) return { key: s.key, label: s.label, state: "done", at: s.at };
    if (!current) { current = true; return { key: s.key, label: s.label, state: "current", at: null }; }
    return { key: s.key, label: s.label, state: "upcoming", at: null };
  });
}

function extras(it: Order["items"][number]): string[] {
  const c = it.config;
  if (!c) return [];
  const out: string[] = [];
  if (c.wear && c.wear.type !== "loose") out.push(`${c.wear.type === "ring" ? "Ring" : "Pendant"}${c.wear.metal ? ` · ${c.wear.metal.label}` : ""}${c.wear.design ? ` · ${c.wear.design.label}` : ""}${c.wear.size ? ` · size ${c.wear.size}` : ""}`);
  if (c.pooja) out.push(`Energization: ${c.pooja.label}`);
  if (c.jaap) out.push(`Mantra jaap: ${c.jaap.label}`);
  return out;
}

export function myOrderView(o: Order): MyOrder {
  const a = o.shippingAddress;
  const refund = o.refund
    ? { amount: o.refund.amount, to: o.refund.to, status: o.refund.status, at: o.refund.at }
    : o.paymentStatus === "refunded" ? { amount: o.pricing.grandTotal, to: "team" as const, status: "processed" as const, at: o.updatedAt } : null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    placedAt: o.placedAt,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMode: o.paymentMethod === "razorpay" ? "online" : o.paymentMethod === "cod" ? "cod" : "other",
    items: o.items.map((it) => ({ productId: it.productId, name: it.name, image: it.image ?? null, variantLabel: it.variantLabel ?? null, qty: it.qty, unitPrice: it.unitPrice, lineTotal: it.lineTotal, extras: extras(it) })),
    itemCount: o.items.reduce((s, it) => s + it.qty, 0),
    pricing: { subtotal: o.pricing.subtotal, discount: o.pricing.discount, couponCode: o.pricing.couponCode ?? null, shipping: o.pricing.shipping, tax: o.pricing.tax, grandTotal: o.pricing.grandTotal },
    address: { name: a.name, phone: a.phone ?? "", line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state ?? "", postalCode: a.postalCode ?? "" },
    tracking: o.fulfillment.trackingNumber ? { courier: o.fulfillment.courier ?? "", number: o.fulfillment.trackingNumber, shippedAt: o.fulfillment.shippedAt ?? null, deliveredAt: o.fulfillment.deliveredAt ?? null } : null,
    steps: steps(o),
    holdUntil: o.status === "pending" && o.paymentStatus === "unpaid" ? o.holdUntil ?? null : null,
    paidAt: o.payment?.paidAt ?? null,
    paymentReference: o.payment?.razorpayPaymentId ?? null,
    refund,
    cancelReason: o.status === "cancelled" ? o.cancelReason || "Cancelled" : null,
    actions: { cancel: orderCancelPolicy(o) },
  };
}

export const myOrdersService = {
  async list(customerId: string): Promise<Result<{ orders: MyOrder[] }>> {
    const all = await getOrderRepository().findByCustomer(customerId);
    return ok({ orders: all.map(myOrderView) });
  },
  async get(customerId: string, orderNumber: string): Promise<Result<{ order: MyOrder }>> {
    const o = await getOrderRepository().findByNumber(orderNumber);
    if (!o || o.customerId !== customerId) return fail(AppErrors.notFound("Order not found"));
    return ok({ order: myOrderView(o) });
  },
  async cancel(customerId: string, orderNumber: string, refundTo: "source" | "wallet"): Promise<Result<{ order: MyOrder }>> {
    const r = await customerCancelOrder(customerId, orderNumber, refundTo);
    return r.ok ? ok({ order: myOrderView(r.value) }) : r;
  },
};
