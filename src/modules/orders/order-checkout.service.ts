import "server-only";

/**
 * Customer checkout for gemstone / samagri orders (app + website).
 *
 * One pricing function (`quote`) is used by the cart screen, COD and online
 * payment, so what the customer sees is exactly what is charged. Everything
 * the client sends except product ids, quantities, configurator choices, the
 * coupon code and the address is ignored.
 *
 * Money and stock rules
 *  • Stock is RESERVED when the order is placed, with one atomic write per line
 *    (never oversold, even with many checkouts at once). A failed line gives
 *    the earlier lines back.
 *  • COD: the order is confirmed at once (stock already reserved).
 *  • Online: the order is pending and holds its stock for ORDER_HOLD_MS. The
 *    sweep releases it if the payment does not arrive (Razorpay is asked
 *    first: a captured payment is settled, an authorized one is left alone).
 *  • A payment is settled exactly once (atomic "unpaid → paid" flip) and only
 *    for the exact amount; a mismatch is recorded for review, never credited.
 *  • Money that arrives after a hold expired: stock is re-reserved and the
 *    order revived, or (if it sold out) refunded in full. After a customer
 *    cancel: refunded in full.
 *  • `requestId` makes a retried "Place order" return the same order.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId, newReference } from "@/core/id";
import { isVisibleOn, type Channel } from "@/core/channels";
import { createRazorpayOrder, createRazorpayRefund, razorpayConfigured, razorpayKeyId } from "@/core/razorpay";
import { productService } from "@/modules/products";
import { customerService } from "@/modules/customers";
import { couponService } from "@/modules/coupons";
import { auditService } from "@/modules/audit";
import { settingsService } from "@/modules/settings";
import { resolveConfig, priceConfig, type ConfigSelection } from "@/modules/configurator";
import { getOrderRepository } from "./order.repository";
import { sendOrderPlaced, sendAdminNewOrderAlert } from "./order.emails";
import { orderService } from "./order.service";
import type { Order, OrderActivity, OrderAddress, OrderItem } from "./order.types";

export const ORDER_HOLD_MS = 15 * 60_000;
export const ORDER_HOLD_EXPIRED = "Payment not completed within 15 minutes";
const CUSTOMER_CANCEL = "Cancelled by the customer";

type Lookup = (orderId: string) => Promise<{ id: string; status: string; amount: number; error_description?: string | null }[]>;

const log = (type: OrderActivity["type"], message: string, actor = "System"): OrderActivity => ({ id: newId("oact"), at: new Date().toISOString(), type, message, actor });
const paise = (r: number) => Math.round(r * 100);

/* ======================================================================= *
 * Quote (cart pricing)
 * ======================================================================= */

export interface CartLineInput { productId: string; variantId?: string; qty: number; config?: ConfigSelection }

export interface QuoteLine {
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  image: string;
  variantLabel?: string;
  unitPrice: number;
  mrp: number;
  qty: number;
  lineTotal: number;
  config?: OrderItem["config"];
  /** Units left (null = not limited). */
  available: number | null;
  /** Why this line cannot be ordered as is (sold out, too many, gone). */
  issue?: string;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  coupon: { code: string; discount: number } | null;
  couponError?: string;
  shipping: number;
  freeShippingAbove: number;
  tax: number;
  taxRate: number;
  grandTotal: number;
  cod: { available: boolean; reason?: string };
  /** Blocking problems; empty = ready to order. */
  issues: string[];
  minQty: number;
  maxQty: number;
}

export async function quote(items: CartLineInput[], opts: { couponCode?: string; customerId?: string; channel: Channel }): Promise<Result<Quote>> {
  if (!items.length) return fail(AppErrors.validation("Your cart is empty"));
  if (items.length > 30) return fail(AppErrors.validation("Too many items in one order (30 max)"));
  const sRes = await settingsService.get();
  const s = sRes.ok ? sRes.value : null;
  const minQty = s?.order.minQtyPerItem ?? 1;
  const maxQty = s?.order.maxQtyPerItem ?? 0;
  const lines: QuoteLine[] = [];
  const issues: string[] = [];

  for (const it of items) {
    const pRes = await productService.getById(it.productId);
    const p = pRes.ok ? pRes.value : null;
    if (!p || (p.status ?? "active") !== "active" || !isVisibleOn(p.channels, opts.channel)) {
      const issue = "This item is no longer available";
      lines.push({ productId: it.productId, variantId: it.variantId, slug: p?.slug ?? "", name: p?.name ?? "Unavailable item", image: p?.image ?? "", unitPrice: 0, mrp: 0, qty: it.qty, lineTotal: 0, available: 0, issue });
      issues.push(`${p?.name ?? "An item"}: ${issue}`);
      continue;
    }
    let unit = p.price;
    let mrp = p.mrp ?? p.price;
    let image = p.image;
    let variantLabel: string | undefined;
    const limited = p.trackInventory !== false && p.allowBackorder !== true;
    let available: number | null = limited ? Math.max(0, p.stockQty ?? 0) : null;
    let issue: string | undefined;

    if (it.variantId) {
      const v = (p.fullVariants ?? []).find((x) => x.sku === it.variantId && x.active !== false);
      if (!v) issue = "This option is no longer available";
      else {
        unit = v.price ?? p.price;
        mrp = v.mrp ?? Math.max(unit, mrp);
        image = v.image || image;
        variantLabel = Object.values(v.optionValues ?? {}).filter(Boolean).join(" / ") || v.sku;
        available = limited ? Math.max(0, v.stockQty ?? 0) : null;
      }
    } else if ((p.fullVariants ?? []).some((x) => x.active !== false) && p.hasVariants) {
      issue = "Please choose an option";
    }

    let config: OrderItem["config"];
    if (!issue && it.config && Object.keys(it.config).length) {
      const resolved = resolveConfig(p.configurator, s?.configurator ?? null);
      const priced = priceConfig(unit, resolved, it.config);
      if (!priced.ok) issue = priced.error ?? "Please check the options you picked";
      else { unit = priced.unitPrice!; config = priced.priced; }
    }

    if (!issue) {
      if (it.qty < minQty) issue = `Minimum ${minQty} per item`;
      else if (maxQty > 0 && it.qty > maxQty) issue = `Maximum ${maxQty} per item`;
      else if (available !== null && available <= 0) issue = "Sold out";
      else if (available !== null && it.qty > available) issue = `Only ${available} left`;
    }
    if (issue) issues.push(`${p.name}: ${issue}`);
    lines.push({ productId: p.id, variantId: it.variantId, slug: p.slug, name: p.name, image, variantLabel, unitPrice: unit, mrp, qty: it.qty, lineTotal: unit * it.qty, config, available, issue });
  }

  const subtotal = lines.filter((l) => !l.issue).reduce((sum, l) => sum + l.lineTotal, 0);
  let discount = 0;
  let coupon: Quote["coupon"] = null;
  let couponError: string | undefined;
  const code = opts.couponCode?.trim();
  if (code && subtotal > 0) {
    const c = await couponService.validate(code, subtotal, opts.customerId);
    if (c.ok) { coupon = { code: c.value.code, discount: Math.min(subtotal, c.value.discount) }; discount = coupon.discount; }
    else couponError = c.error.message;
  }
  const taxable = Math.max(0, subtotal - discount);
  const freeShippingAbove = s?.shipping.freeShippingThreshold ?? 0;
  const shipping = subtotal === 0 ? 0 : freeShippingAbove > 0 && taxable >= freeShippingAbove ? 0 : (s?.shipping.flatRate ?? 0);
  const taxRate = s?.tax.rate ?? 0;
  const tax = taxRate ? Math.round((taxable * taxRate) / 100) : 0;
  const grandTotal = taxable + shipping + tax;
  const minOrder = s?.checkout.minOrderValue ?? 0;
  if (minOrder > 0 && subtotal > 0 && taxable < minOrder) issues.push(`Minimum order value is ₹${minOrder.toLocaleString("en-IN")}`);

  const codOn = s?.checkout.codEnabled !== false;
  const codMax = s?.checkout.codMaxOrderValue ?? 0;
  const cod = !codOn
    ? { available: false, reason: "Cash on Delivery is not available right now" }
    : codMax > 0 && grandTotal > codMax
      ? { available: false, reason: `Cash on Delivery is available up to ₹${codMax.toLocaleString("en-IN")}. Please pay online.` }
      : { available: true };

  return ok({ lines, subtotal, discount, coupon, couponError, shipping, freeShippingAbove, tax, taxRate, grandTotal, cod, issues, minQty, maxQty });
}

/* ======================================================================= *
 * Place order
 * ======================================================================= */

export interface PlaceInput {
  items: CartLineInput[];
  couponCode?: string;
  shippingAddress: OrderAddress;
  method: "cod" | "online";
  requestId: string;
  /** Fills gaps on the account (phone sign-ups have no email). The account wins. */
  contact?: { name?: string; email?: string; phone?: string };
  notes?: string;
}

/** Give back every unit an order holds. Safe to call twice: callers flip `stockReserved` first. */
async function releaseLines(items: Pick<OrderItem, "productId" | "variantId" | "qty">[]) {
  for (const it of items) await productService.releaseStock(it.productId, it.variantId, it.qty).catch(() => undefined);
}

/** Reserve every line or none. Returns the first line that could not be reserved. */
async function reserveAll(items: Pick<OrderItem, "productId" | "variantId" | "qty" | "name">[]): Promise<{ ok: true } | { ok: false; name: string }> {
  const done: typeof items = [];
  for (const it of items) {
    if (await productService.reserveStock(it.productId, it.variantId, it.qty)) { done.push(it); continue; }
    await releaseLines(done);
    return { ok: false, name: it.name };
  }
  return { ok: true };
}

function isDuplicate(e: unknown, field: string): boolean {
  const err = e as { code?: number; keyPattern?: Record<string, unknown>; message?: string };
  return err?.code === 11000 && (Boolean(err.keyPattern?.[field]) || String(err.message ?? "").includes(field));
}

/** After an order is confirmed for the first time: emails (fire-and-forget). */
async function notifyPlaced(o: Order) {
  const sRes = await settingsService.get();
  const notif = sRes.ok ? sRes.value.notifications : null;
  if (notif?.sendOrderConfirmation !== false) void sendOrderPlaced(o).catch(() => {});
  if (notif?.adminAlertEmail) void sendAdminNewOrderAlert(o, notif.adminAlertEmail).catch(() => {});
}

export async function placeOrder(customerId: string, input: PlaceInput, channel: Channel): Promise<Result<Order>> {
  const repo = getOrderRepository();
  const again = await repo.findByRequestId(input.requestId);
  if (again) return again.customerId === customerId ? ok(again) : fail(AppErrors.conflict("This request was already used. Please try again."));

  const q = await quote(input.items, { couponCode: input.couponCode, customerId, channel });
  if (!q.ok) return q;
  const qt = q.value;
  if (qt.issues.length) return fail(AppErrors.validation(qt.issues[0], { issues: qt.issues }));
  if (input.couponCode?.trim() && !qt.coupon) return fail(AppErrors.validation(qt.couponError ?? "This coupon cannot be applied"));
  if (input.method === "cod" && !qt.cod.available) return fail(AppErrors.validation(qt.cod.reason ?? "Cash on Delivery is not available"));
  if (input.method === "online" && !razorpayConfigured()) return fail(AppErrors.validation("Online payment is not available right now. Please choose Cash on Delivery."));

  // Identity: the account wins; the form only fills gaps.
  const cRes = await customerService.getById(customerId);
  if (!cRes.ok) return fail(AppErrors.unauthorized("Please sign in again"));
  const c = cRes.value;
  const email = (c.email || input.contact?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(AppErrors.validation("Please add your email so we can send the order details."));
  const customer = { name: (c.name || input.contact?.name || input.shippingAddress.name).trim().slice(0, 120), email, phone: c.phone || input.contact?.phone || input.shippingAddress.phone || undefined };

  const items: OrderItem[] = qt.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, image: l.image || undefined, variantLabel: l.variantLabel, unitPrice: l.unitPrice, qty: l.qty, lineTotal: l.lineTotal, config: l.config }));
  const held = await reserveAll(items);
  if (!held.ok) return fail(AppErrors.conflict(`${held.name} just sold out or has fewer left. Please update your cart.`));

  const sRes = await settingsService.get();
  const prefix = sRes.ok ? sRes.value.order.numberPrefix ?? "NK" : "NK";
  const now = new Date();
  const cod = input.method === "cod";
  const base: Order = {
    id: newId("ord"),
    orderNumber: newReference(prefix),
    customerId,
    customer,
    items,
    pricing: { subtotal: qt.subtotal, discount: qt.discount, couponCode: qt.coupon?.code, shipping: qt.shipping, tax: qt.tax, grandTotal: qt.grandTotal },
    shippingAddress: { ...input.shippingAddress, country: input.shippingAddress.country || "India" },
    status: cod ? "confirmed" : "pending",
    paymentStatus: "unpaid",
    paymentMethod: cod ? "cod" : "razorpay",
    fulfillment: {},
    notes: input.notes || undefined,
    activity: [log("created", `Order placed ${channel === "app" ? "in the app" : "on the website"} · ${cod ? "Cash on Delivery" : `paying online (stock held ${ORDER_HOLD_MS / 60000} min)`}`, "Customer")],
    placedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    requestId: input.requestId,
    channel,
    stockReserved: true,
    holdUntil: cod ? null : new Date(now.getTime() + ORDER_HOLD_MS).toISOString(),
  };

  let created: Order | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await repo.create(attempt ? { ...base, orderNumber: newReference(prefix) } : base);
    } catch (e) {
      if (isDuplicate(e, "requestId")) {
        await releaseLines(items);
        const existing = await repo.findByRequestId(input.requestId);
        return existing && existing.customerId === customerId ? ok(existing) : fail(AppErrors.conflict("This request was already used. Please try again."));
      }
      if (isDuplicate(e, "orderNumber")) continue;
      await releaseLines(items);
      throw e;
    }
  }
  if (!created) { await releaseLines(items); return fail(AppErrors.internal("Could not place the order. Please try again.")); }

  await auditService.record({ action: "create", entity: "order", entityId: created.id, entityLabel: created.orderNumber, summary: `Order ${created.orderNumber} placed by customer (${cod ? "COD" : "online"}, ₹${created.pricing.grandTotal})` });
  if (cod) {
    await onConfirmed(created);
    void notifyPlaced(created);
  }
  return ok(created);
}

/** First confirmation side effects (stock is already reserved): stats, coupon, sold counter. */
async function onConfirmed(o: Order) {
  if (o.customerId) await customerService.recordOrder(o.customerId, o.pricing.grandTotal, o.orderNumber, o.placedAt).catch(() => undefined);
  if (o.pricing.couponCode) await couponService.recordUsage(o.pricing.couponCode, o.pricing.subtotal, { customerId: o.customerId, orderNumber: o.orderNumber }).catch(() => undefined);
  for (const it of o.items) await productService.incrementCounter(it.productId, "sold", it.qty).catch(() => undefined);
  // Remedy commission: a suggested item may have just been bought (the sweep also catches it).
  if (o.customerId) void import("@/modules/remedies").then((m) => m.remedyService.maybeSweep(5_000)).catch(() => undefined);
}

/* ======================================================================= *
 * Online payment
 * ======================================================================= */

export interface OnlineStart {
  order: Order;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
  keyId: string;
}

/** Place (or re-use) the online order and make sure it has a Razorpay order. */
export async function startOnline(customerId: string, input: PlaceInput, channel: Channel): Promise<Result<OnlineStart>> {
  const placed = await placeOrder(customerId, { ...input, method: "online" }, channel);
  if (!placed.ok) return placed;
  let o = placed.value;
  if (o.paymentMethod !== "razorpay") return fail(AppErrors.conflict("This order was placed as Cash on Delivery."));
  if (o.paymentStatus !== "unpaid") return fail(AppErrors.conflict(`Order ${o.orderNumber} is already paid.`));
  if (o.status !== "pending") return fail(AppErrors.conflict("This order is no longer waiting for payment. Please place a new order."));

  if (!o.payment?.razorpayOrderId) {
    let rz;
    try {
      rz = await createRazorpayOrder({ amountInRupees: o.pricing.grandTotal, receipt: o.orderNumber, notes: { orderId: o.id, orderNumber: o.orderNumber } });
    } catch (e) {
      // Never hold stock for a payment that can never start.
      await cancelAndRelease(o, "Online payment could not be started", "System");
      return fail(AppErrors.internal(e instanceof Error ? `Could not start the payment: ${e.message.slice(0, 120)}` : "Could not start the payment."));
    }
    const repo = getOrderRepository();
    const attached = await repo.updateIf(o.id, ["pending"], "unpaid", { payment: { provider: "razorpay", razorpayOrderId: rz.id } });
    if (!attached) {
      const fresh = await repo.findById(o.id);
      if (!fresh?.payment?.razorpayOrderId) return fail(AppErrors.conflict("This order changed meanwhile. Please try again."));
      o = fresh;
    } else o = attached;
  }
  return ok({ order: o, razorpayOrderId: o.payment!.razorpayOrderId!, amount: paise(o.pricing.grandTotal), currency: "INR", keyId: razorpayKeyId() ?? "" });
}

export type SettleOutcome = "confirmed" | "already" | "revived" | "refunded" | "mismatch";

/**
 * Settle a verified / captured Razorpay payment. Exactly once, exact amount.
 * Safe to call from the app, the website, the webhook and the status poll at the same time.
 */
export async function settlePayment(razorpayOrderId: string, razorpayPaymentId: string, amountPaise?: number, razorpaySignature?: string): Promise<Result<{ order: Order; outcome: SettleOutcome }>> {
  const repo = getOrderRepository();
  for (let attempt = 0; attempt < 4; attempt++) {
    const o = await repo.findByRazorpayOrderId(razorpayOrderId);
    if (!o) return fail(AppErrors.notFound("Order not found"));
    if (o.paymentStatus !== "unpaid") return ok({ order: o, outcome: o.status === "cancelled" || o.paymentStatus === "refunded" ? "refunded" : "already" });

    if (amountPaise !== undefined && amountPaise !== paise(o.pricing.grandTotal)) {
      if (!o.activity.some((a) => a.message.includes(razorpayPaymentId))) {
        await repo.update(o.id, { activity: [log("payment", `Payment ${razorpayPaymentId} of ₹${amountPaise / 100} does NOT match the order total ₹${o.pricing.grandTotal}. Not credited; check in Razorpay.`), ...o.activity].slice(0, 50) });
        await auditService.record({ action: "payment", entity: "order", entityId: o.id, entityLabel: o.orderNumber, summary: `Amount mismatch on ${o.orderNumber}: paid ₹${amountPaise / 100}, total ₹${o.pricing.grandTotal}` }).catch(() => undefined);
      }
      return ok({ order: o, outcome: "mismatch" });
    }

    const payment = { provider: "razorpay" as const, razorpayOrderId, razorpayPaymentId, razorpaySignature, paidAt: new Date().toISOString() };

    // Hold ran out but the money came: take the stock again, or refund if it sold out.
    if (o.status === "cancelled" && o.cancelReason === ORDER_HOLD_EXPIRED) {
      const held = await reserveAll(o.items);
      if (held.ok) {
        const revived = await repo.updateIf(o.id, ["cancelled"], "unpaid", { status: "confirmed", paymentStatus: "paid", payment, stockReserved: true, holdUntil: null, cancelReason: "", updatedAt: payment.paidAt, activity: [log("payment", "Payment received after the hold ended. Stock re-reserved, order confirmed."), ...o.activity].slice(0, 50) });
        if (!revived) { await releaseLines(o.items); continue; }
        await onConfirmed(revived);
        void notifyPlaced(revived);
        return ok({ order: revived, outcome: "revived" });
      }
    }

    if (o.status === "cancelled") {
      const paidLate = await repo.updateIf(o.id, ["cancelled"], "unpaid", { paymentStatus: "paid", payment, updatedAt: payment.paidAt, activity: [log("payment", "Payment received after the order was cancelled. Refunding in full."), ...o.activity].slice(0, 50) });
      if (!paidLate) continue;
      const r = await refundOrder(paidLate, "source", "paid after cancellation");
      return ok({ order: r, outcome: "refunded" });
    }

    const won = await repo.updateIf(o.id, [o.status], "unpaid", { paymentStatus: "paid", payment, holdUntil: null, updatedAt: payment.paidAt, activity: [log("payment", `Payment received online (${razorpayPaymentId})`), ...o.activity].slice(0, 50) });
    if (!won) continue; // someone else settled or changed it: re-read
    if (won.status === "pending") {
      const conf = await repo.updateIf(won.id, ["pending"], "paid", { status: "confirmed", activity: [log("status", 'Status changed from "pending" to "confirmed"'), ...won.activity].slice(0, 50) });
      const fin = conf ?? (await repo.findById(won.id)) ?? won;
      if (conf) { await onConfirmed(conf); void notifyPlaced(conf); }
      return ok({ order: fin, outcome: "confirmed" });
    }
    return ok({ order: won, outcome: "confirmed" });
  }
  const last = await repo.findByRazorpayOrderId(razorpayOrderId);
  return last ? ok({ order: last, outcome: "already" }) : fail(AppErrors.notFound("Order not found"));
}

export interface OrderPayStatus {
  /** paid | processing (check again) | pending (no attempt yet) | failed | expired (hold ended) | refunded | review (amount mismatch) */
  state: "paid" | "processing" | "pending" | "failed" | "expired" | "refunded" | "review";
  orderNumber: string;
  status: Order["status"];
  total: number;
  holdUntil: string | null;
  reason?: string;
}

/** Where does this online order stand? Reconciles with Razorpay. Own orders only. */
export async function paymentStatus(customerId: string, razorpayOrderId: string, lookup: Lookup): Promise<Result<OrderPayStatus>> {
  const repo = getOrderRepository();
  let o = await repo.findByRazorpayOrderId(razorpayOrderId);
  if (!o || o.customerId !== customerId) return fail(AppErrors.notFound("Order not found"));
  const view = (state: OrderPayStatus["state"], x: Order, reason?: string): OrderPayStatus => ({ state, orderNumber: x.orderNumber, status: x.status, total: x.pricing.grandTotal, holdUntil: x.holdUntil ?? null, ...(reason ? { reason } : {}) });
  if (o.paymentStatus !== "unpaid") return ok(view(o.status === "cancelled" || o.paymentStatus === "refunded" ? "refunded" : "paid", o));
  let payments;
  try { payments = await lookup(razorpayOrderId); } catch { return ok(view(o.status === "cancelled" ? "expired" : "pending", o)); }
  const captured = payments.find((p) => p.status === "captured");
  if (captured) {
    const s = await settlePayment(razorpayOrderId, captured.id, captured.amount);
    if (!s.ok) return ok(view("pending", o));
    o = s.value.order;
    if (s.value.outcome === "mismatch") return ok(view("review", o));
    if (s.value.outcome === "refunded") return ok(view("refunded", o));
    return ok(view("paid", o));
  }
  if (o.status === "cancelled") return ok(view("expired", o));
  if (payments.some((p) => p.status === "authorized")) return ok(view("processing", o));
  const failed = payments.filter((p) => p.status === "failed");
  if (failed.length && failed.length === payments.length) return ok(view("failed", o, failed[0].error_description || "The payment did not go through."));
  return ok(view(payments.length ? "processing" : "pending", o));
}

/* ======================================================================= *
 * Holds, cancel, refund
 * ======================================================================= */

/** Flip to cancelled atomically, then give the stock back and undo stats. */
async function cancelAndRelease(o: Order, reason: string, actor: string, extra: Partial<Order> = {}): Promise<Order | null> {
  const repo = getOrderRepository();
  const committedBefore = ["confirmed", "packed", "shipped", "delivered"].includes(o.status);
  const holdsStock = o.stockReserved || committedBefore;
  const done = await repo.updateIf(o.id, [o.status], o.paymentStatus, {
    status: "cancelled", cancelReason: reason, holdUntil: null, stockReserved: false, updatedAt: new Date().toISOString(),
    activity: [log("status", `Cancelled: ${reason}${holdsStock ? ". Stock released." : ""}`, actor), ...o.activity].slice(0, 50),
    ...extra,
  });
  if (!done) return null;
  if (holdsStock) {
    if (o.stockReserved) await releaseLines(o.items);
    else await orderService.commitStock(o, +1);
  }
  if (committedBefore && o.customerId) await customerService.revertOrder(o.customerId, o.pricing.grandTotal, o.orderNumber).catch(() => undefined);
  return done;
}

/** Release stock of online orders whose hold ran out (Razorpay is asked first). */
export async function sweepExpiredOrderHolds(lookup: Lookup, now = Date.now()): Promise<{ checked: number; cancelled: number; settled: number }> {
  const repo = getOrderRepository();
  const due = await repo.listExpiredHolds(new Date(now).toISOString(), 50);
  let cancelled = 0, settled = 0;
  for (const o of due) {
    const rzId = o.payment?.razorpayOrderId;
    if (rzId) {
      let payments;
      try { payments = await lookup(rzId); } catch { continue; }
      const captured = payments.find((p) => p.status === "captured");
      if (captured) { const s = await settlePayment(rzId, captured.id, captured.amount); if (s.ok) settled++; continue; }
      if (payments.some((p) => p.status === "authorized")) continue;
    }
    if (await cancelAndRelease(o, ORDER_HOLD_EXPIRED, "System")) cancelled++;
  }
  return { checked: due.length, cancelled, settled };
}

let lastSweep = 0;
let sweeping: Promise<unknown> | null = null;
/** Throttled sweep for request paths (works without a cron). */
export function maybeSweepOrderHolds(lookup: Lookup, everyMs = 60_000): void {
  if (sweeping || Date.now() - lastSweep < everyMs) return;
  lastSweep = Date.now();
  sweeping = sweepExpiredOrderHolds(lookup).catch(() => undefined).finally(() => { sweeping = null; });
}

/** Can the customer cancel this order now? */
export function orderCancelPolicy(o: Order): { allowed: boolean; refundAmount: number; refundTo: ("source" | "wallet")[]; why: string } {
  const refundTo: ("source" | "wallet")[] = [];
  const paidOnline = o.paymentStatus === "paid" && o.paymentMethod === "razorpay" && Boolean(o.payment?.razorpayPaymentId);
  if (paidOnline) refundTo.push("source");
  if (o.paymentStatus === "paid" && o.customerId) refundTo.push("wallet");
  if (o.status === "pending" || (o.status === "confirmed" && o.paymentStatus === "unpaid")) return { allowed: true, refundAmount: 0, refundTo: [], why: "" };
  if (o.status === "confirmed" && o.paymentStatus === "paid") {
    if (!refundTo.length) return { allowed: false, refundAmount: 0, refundTo, why: "This order was paid to our team. Please contact support to cancel it." };
    return { allowed: true, refundAmount: o.pricing.grandTotal, refundTo, why: "" };
  }
  if (o.status === "packed" || o.status === "shipped") return { allowed: false, refundAmount: 0, refundTo, why: "Your order is already packed for shipping, so it cannot be cancelled here. Please contact support." };
  return { allowed: false, refundAmount: 0, refundTo, why: "" };
}

/** Customer cancels their own order (pre-pack). Atomic; refunds a paid order exactly once. */
export async function customerCancelOrder(customerId: string, orderNumber: string, refundTo: "source" | "wallet"): Promise<Result<Order>> {
  const repo = getOrderRepository();
  for (let attempt = 0; attempt < 3; attempt++) {
    const o = await repo.findByNumber(orderNumber);
    if (!o || o.customerId !== customerId) return fail(AppErrors.notFound("Order not found"));
    if (o.status === "cancelled") return ok(o);
    const pol = orderCancelPolicy(o);
    if (!pol.allowed) return fail(AppErrors.validation(pol.why || "This order can no longer be cancelled in the app. Please contact support."));
    if (pol.refundAmount > 0 && !pol.refundTo.includes(refundTo)) return fail(AppErrors.validation("Please choose where the refund should go."));
    const done = await cancelAndRelease(o, CUSTOMER_CANCEL, "Customer");
    if (!done) continue; // changed meanwhile (e.g. just packed): re-check the policy
    await auditService.record({ action: "status", entity: "order", entityId: o.id, entityLabel: o.orderNumber, summary: `Customer cancelled ${o.orderNumber}${pol.refundAmount ? ` (refund ₹${pol.refundAmount} to ${refundTo})` : ""}` }).catch(() => undefined);
    return ok(pol.refundAmount > 0 ? await refundOrder(done, refundTo, "cancelled by customer") : done);
  }
  return fail(AppErrors.conflict("This order was just updated by our team. Please refresh and check again."));
}

/** Full refund of a paid order. The `refund` field guards against a second refund. */
async function refundOrder(o: Order, to: "source" | "wallet", why: string): Promise<Order> {
  const repo = getOrderRepository();
  if (o.refund?.status === "processed") return o;
  const amount = o.pricing.grandTotal;
  const at = new Date().toISOString();
  let refund: NonNullable<Order["refund"]>;
  if (to === "wallet" && o.customerId) {
    try {
      const { walletService } = await import("@/modules/wallets");
      const w = await walletService.refund(o.customerId, `ordrefund_${o.id}`, { cashPaise: paise(amount), promoPaise: 0 }, o.orderNumber, `Refund for order ${o.orderNumber}`, "System");
      if (w.status === "insufficient") throw new Error("wallet refused the credit");
      refund = { amount, to, status: "processed", reference: w.txn?.id ?? "", at };
    } catch (e) {
      refund = { amount, to, status: "failed", reference: "", at, error: e instanceof Error ? e.message.slice(0, 160) : "wallet error" };
    }
  } else {
    try {
      const rz = await createRazorpayRefund({ paymentId: o.payment?.razorpayPaymentId ?? "", amountInRupees: amount, receipt: `ord_${o.orderNumber}`.slice(0, 40), notes: { orderNumber: o.orderNumber, reason: why } });
      refund = { amount, to: "source", status: "processed", reference: rz.id, at };
    } catch (e) {
      refund = { amount, to: "source", status: "failed", reference: "", at, error: e instanceof Error ? e.message.slice(0, 160) : "gateway error" };
    }
  }
  const okDone = refund.status === "processed";
  const updated = await repo.update(o.id, {
    refund,
    ...(okDone ? { paymentStatus: "refunded" as const } : {}),
    updatedAt: at,
    activity: [log("payment", okDone ? `Refunded ₹${amount} to ${refund.to === "wallet" ? "the AstroUnkle wallet" : "the original payment method"} (${refund.reference}): ${why}` : `Refund of ₹${amount} FAILED, refund it manually: ${refund.error}`), ...o.activity].slice(0, 50),
  });
  await auditService.record({ action: "refund", entity: "order", entityId: o.id, entityLabel: o.orderNumber, summary: okDone ? `Refunded ₹${amount} for ${o.orderNumber} to ${refund.to}` : `Refund FAILED for ${o.orderNumber}: refund ₹${amount} manually` }).catch(() => undefined);
  return updated ?? o;
}
