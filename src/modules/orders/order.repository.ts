/**
 * Orders domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory, pre-seeded (used when DATA_SOURCE_ORDERS != mongo).
 *  • mongo — Mongoose model (production), soft-delete aware.
 */

import { dataSourceFor } from "@/core/config/env";
import { orders as seed } from "@/data/orders";
import type { Order, OrderItem } from "./order.types";
import type { OrderDoc } from "./order.model";

export interface OrderRepository {
  findAll(): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  findByCustomer(customerId: string): Promise<Order[]>;
  findByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null>;
  create(order: Order): Promise<Order>;
  update(id: string, patch: Partial<Order>): Promise<Order | null>;
  /**
   * Apply `patch` ONLY while the order is in one of `statuses` (and, when
   * given, has this payment status). Atomic: of two racing writers exactly one
   * wins; the loser gets null and re-reads.
   */
  updateIf(id: string, statuses: Order["status"][], paymentStatus: Order["paymentStatus"] | null, patch: Partial<Order>): Promise<Order | null>;
  findByRequestId(requestId: string): Promise<Order | null>;
  findByNumber(orderNumber: string): Promise<Order | null>;
  /** Unpaid online orders whose stock hold ended before `nowIso`. */
  listExpiredHolds(nowIso: string, limit: number): Promise<Order[]>;
  remove(id: string): Promise<boolean>;
}

const store: Order[] = seed.map((o) => ({ ...o }));

const mockOrderRepository: OrderRepository = {
  async findAll() {
    return store.map((o) => ({ ...o }));
  },
  async findById(id) {
    const o = store.find((x) => x.id === id);
    return o ? { ...o } : null;
  },
  async findByCustomer(customerId) {
    return store.filter((o) => o.customerId === customerId).map((o) => ({ ...o }));
  },
  async findByRazorpayOrderId(razorpayOrderId) {
    const o = store.find((x) => x.payment?.razorpayOrderId === razorpayOrderId);
    return o ? { ...o } : null;
  },
  async create(order) {
    store.unshift(order);
    return { ...order };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  },
  async updateIf(id, statuses, paymentStatus, patch) {
    const idx = store.findIndex((x) => x.id === id);
    const o = idx === -1 ? null : store[idx];
    if (!o || !statuses.includes(o.status) || (paymentStatus && o.paymentStatus !== paymentStatus)) return null;
    store[idx] = { ...o, ...patch };
    return { ...store[idx] };
  },
  async findByRequestId(requestId) {
    const o = store.find((x) => x.requestId === requestId);
    return o ? { ...o } : null;
  },
  async findByNumber(orderNumber) {
    const o = store.find((x) => x.orderNumber === orderNumber);
    return o ? { ...o } : null;
  },
  async listExpiredHolds(nowIso, limit) {
    return store.filter((o) => o.status === "pending" && o.paymentStatus === "unpaid" && typeof o.holdUntil === "string" && o.holdUntil < nowIso).slice(0, limit).map((o) => ({ ...o }));
  },
  async remove(id) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { OrderModel } = await import("./order.model");
  await connectMongoose();
  return OrderModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Map a Mongoose lean doc → the app's Order shape. */
function fromDoc(doc: OrderDoc): Order {
  const upd = (doc as unknown as { updatedAt?: Date }).updatedAt;
  return {
    id: String(doc._id),
    orderNumber: doc.orderNumber,
    customerId: doc.customerId ?? undefined,
    customer: {
      name: doc.customer?.name ?? "",
      email: doc.customer?.email ?? "",
      phone: doc.customer?.phone ?? undefined,
    },
    items: (doc.items ?? []).map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      name: i.name,
      image: i.image ?? undefined,
      sku: i.sku ?? undefined,
      variantLabel: i.variantLabel ?? undefined,
      unitPrice: i.unitPrice,
      qty: i.qty,
      lineTotal: i.lineTotal,
      config: (i as { config?: unknown }).config as OrderItem["config"],
    })),
    pricing: {
      subtotal: doc.pricing?.subtotal ?? 0,
      discount: doc.pricing?.discount ?? 0,
      couponCode: doc.pricing?.couponCode ?? undefined,
      shipping: doc.pricing?.shipping ?? 0,
      tax: doc.pricing?.tax ?? 0,
      grandTotal: doc.pricing?.grandTotal ?? 0,
    },
    shippingAddress: mapAddr(doc.shippingAddress),
    billingAddress: doc.billingAddress ? mapAddr(doc.billingAddress) : undefined,
    status: doc.status as Order["status"],
    paymentStatus: doc.paymentStatus as Order["paymentStatus"],
    paymentMethod: doc.paymentMethod as Order["paymentMethod"],
    payment: doc.payment
      ? {
          provider: "razorpay",
          razorpayOrderId: doc.payment.razorpayOrderId ?? undefined,
          razorpayPaymentId: doc.payment.razorpayPaymentId ?? undefined,
          razorpaySignature: doc.payment.razorpaySignature ?? undefined,
          paidAt: doc.payment.paidAt ?? undefined,
        }
      : undefined,
    fulfillment: {
      courier: doc.fulfillment?.courier ?? undefined,
      trackingNumber: doc.fulfillment?.trackingNumber ?? undefined,
      shippedAt: doc.fulfillment?.shippedAt ?? undefined,
      deliveredAt: doc.fulfillment?.deliveredAt ?? undefined,
    },
    notes: doc.notes ?? undefined,
    activity: (doc.activity ?? []).map((a) => ({
      id: a.id,
      at: a.at,
      type: a.type as Order["activity"][number]["type"],
      message: a.message,
      actor: a.actor ?? undefined,
    })),
    placedAt: doc.placedAt,
    updatedAt: upd?.toISOString?.() ?? doc.placedAt,
    ...checkoutFields(doc),
  };
}

/** Checkout fields (only set on orders placed by customers after hardening). */
function checkoutFields(doc: OrderDoc): Partial<Order> {
  const d = doc as unknown as { requestId?: string | null; channel?: string | null; stockReserved?: boolean | null; holdUntil?: string | null; cancelReason?: string | null; refund?: Order["refund"] };
  return {
    ...(d.requestId ? { requestId: d.requestId } : {}),
    ...(d.channel === "web" || d.channel === "app" ? { channel: d.channel } : {}),
    stockReserved: Boolean(d.stockReserved),
    holdUntil: d.holdUntil ?? null,
    ...(d.cancelReason ? { cancelReason: d.cancelReason } : {}),
    refund: d.refund ?? null,
  };
}

function mapAddr(a: OrderDoc["shippingAddress"]): Order["shippingAddress"] {
  return {
    name: a?.name ?? "",
    phone: a?.phone ?? undefined,
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? undefined,
    city: a?.city ?? "",
    state: a?.state ?? undefined,
    postalCode: a?.postalCode ?? undefined,
    country: a?.country ?? "India",
  };
}

/** Map an app Order (service output) → a Mongo document shape. */
function toDoc(p: Partial<Order>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.orderNumber !== undefined) out.orderNumber = p.orderNumber;
  if (p.customerId !== undefined) out.customerId = p.customerId ?? null;
  if (p.customer !== undefined) out.customer = p.customer;
  if (p.items !== undefined) out.items = p.items;
  if (p.pricing !== undefined) out.pricing = p.pricing;
  if (p.shippingAddress !== undefined) out.shippingAddress = p.shippingAddress;
  if (p.billingAddress !== undefined) out.billingAddress = p.billingAddress;
  if (p.status !== undefined) out.status = p.status;
  if (p.paymentStatus !== undefined) out.paymentStatus = p.paymentStatus;
  if (p.paymentMethod !== undefined) out.paymentMethod = p.paymentMethod;
  if (p.payment !== undefined) out.payment = p.payment;
  if (p.fulfillment !== undefined) out.fulfillment = p.fulfillment;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  if (p.activity !== undefined) out.activity = p.activity;
  if (p.placedAt !== undefined) out.placedAt = p.placedAt;
  if (p.requestId !== undefined) out.requestId = p.requestId;
  if (p.channel !== undefined) out.channel = p.channel;
  if (p.stockReserved !== undefined) out.stockReserved = p.stockReserved;
  if (p.holdUntil !== undefined) out.holdUntil = p.holdUntil ?? null;
  if (p.cancelReason !== undefined) out.cancelReason = p.cancelReason;
  if (p.refund !== undefined) out.refund = p.refund ?? null;
  return out;
}

const mongoOrderRepository: OrderRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ placedAt: -1 }).lean<OrderDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByCustomer(customerId) {
    const M = await model();
    if (!isObjectId(customerId)) return [];
    const docs = await M.find({ customerId, ...notDeleted })
      .sort({ placedAt: -1 })
      .lean<OrderDoc[]>();
    return docs.map(fromDoc);
  },
  async findByRazorpayOrderId(razorpayOrderId) {
    const M = await model();
    const doc = await M.findOne({ "payment.razorpayOrderId": razorpayOrderId, ...notDeleted }).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(order) {
    const M = await model();
    const created = await M.create(toDoc(order));
    return fromDoc(created.toObject() as OrderDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async updateIf(id, statuses, paymentStatus, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted, status: { $in: statuses }, ...(paymentStatus ? { paymentStatus } : {}) },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByRequestId(requestId) {
    const M = await model();
    const doc = await M.findOne({ requestId, ...notDeleted }).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByNumber(orderNumber) {
    const M = await model();
    const doc = await M.findOne({ orderNumber, ...notDeleted }).lean<OrderDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async listExpiredHolds(nowIso, limit) {
    const M = await model();
    const docs = await M.find({ ...notDeleted, status: "pending", paymentStatus: "unpaid", holdUntil: { $type: "string", $lt: nowIso } }).limit(Math.min(limit, 200)).lean<OrderDoc[]>();
    return docs.map(fromDoc);
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<OrderDoc>();
    return Boolean(res);
  },
};

export function getOrderRepository(): OrderRepository {
  switch (dataSourceFor("orders")) {
    case "mongo":
      return mongoOrderRepository;
    case "mock":
    default:
      return mockOrderRepository;
  }
}
