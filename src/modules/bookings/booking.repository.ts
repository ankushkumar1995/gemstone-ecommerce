/**
 * Service Bookings domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory (empty by default; bookings are created at runtime).
 *  • mongo — Mongoose model (production), soft-delete aware.
 *
 * Switch with DATA_SOURCE_BOOKINGS=mongo.
 */

import { dataSourceFor } from "@/core/config/env";
import type { Booking } from "./booking.types";
import type { BookingDoc } from "./booking.model";

export interface BookingRepository {
  findAll(): Promise<Booking[]>;
  findById(id: string): Promise<Booking | null>;
  findByCustomer(customerId: string): Promise<Booking[]>;
  findByRazorpayOrderId(razorpayOrderId: string): Promise<Booking | null>;
  create(booking: Booking): Promise<Booking>;
  update(id: string, patch: Partial<Booking>): Promise<Booking | null>;
  remove(id: string): Promise<boolean>;
}

const store: Booking[] = [];

const mockBookingRepository: BookingRepository = {
  async findAll() {
    return store.map((b) => ({ ...b }));
  },
  async findById(id) {
    const b = store.find((x) => x.id === id);
    return b ? { ...b } : null;
  },
  async findByCustomer(customerId) {
    return store.filter((b) => b.customerId === customerId).map((b) => ({ ...b }));
  },
  async findByRazorpayOrderId(rzpId) {
    const b = store.find((x) => x.payment?.razorpayOrderId === rzpId);
    return b ? { ...b } : null;
  },
  async create(booking) {
    store.unshift(booking);
    return { ...booking };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
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
  const { BookingModel } = await import("./booking.model");
  await connectMongoose();
  return BookingModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

function fromDoc(doc: BookingDoc): Booking {
  const upd = (doc as unknown as { updatedAt?: Date }).updatedAt;
  return {
    id: String(doc._id),
    bookingNumber: doc.bookingNumber,
    serviceId: doc.serviceId,
    serviceSlug: doc.serviceSlug ?? "",
    serviceTitle: doc.serviceTitle,
    serviceDuration: doc.serviceDuration ?? undefined,
    customerId: doc.customerId ?? undefined,
    customer: {
      name: doc.customer?.name ?? "",
      email: doc.customer?.email ?? "",
      phone: doc.customer?.phone ?? undefined,
    },
    intake: {
      fullName: doc.intake?.fullName ?? "",
      phone: doc.intake?.phone ?? "",
      dob: doc.intake?.dob ?? undefined,
      birthTime: doc.intake?.birthTime ?? undefined,
      birthPlace: doc.intake?.birthPlace ?? undefined,
      gender: (doc.intake?.gender ?? "") as Booking["intake"]["gender"],
      message: doc.intake?.message ?? undefined,
    },
    preferredAt: doc.preferredAt ?? undefined,
    amount: doc.amount ?? 0,
    status: doc.status as Booking["status"],
    paymentStatus: doc.paymentStatus as Booking["paymentStatus"],
    paymentMethod: doc.paymentMethod as Booking["paymentMethod"],
    payment: doc.payment
      ? {
          provider: "razorpay",
          razorpayOrderId: doc.payment.razorpayOrderId ?? undefined,
          razorpayPaymentId: doc.payment.razorpayPaymentId ?? undefined,
          razorpaySignature: doc.payment.razorpaySignature ?? undefined,
          paidAt: doc.payment.paidAt ?? undefined,
        }
      : undefined,
    scheduledAt: doc.scheduledAt ?? undefined,
    adminNotes: doc.adminNotes ?? undefined,
    activity: (doc.activity ?? []).map((a) => ({
      id: a.id,
      at: a.at,
      type: a.type as Booking["activity"][number]["type"],
      message: a.message,
      actor: a.actor ?? undefined,
    })),
    placedAt: doc.placedAt,
    updatedAt: upd?.toISOString?.() ?? doc.placedAt,
  };
}

function toDoc(p: Partial<Booking>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.bookingNumber !== undefined) out.bookingNumber = p.bookingNumber;
  if (p.serviceId !== undefined) out.serviceId = p.serviceId;
  if (p.serviceSlug !== undefined) out.serviceSlug = p.serviceSlug;
  if (p.serviceTitle !== undefined) out.serviceTitle = p.serviceTitle;
  if (p.serviceDuration !== undefined) out.serviceDuration = p.serviceDuration ?? null;
  if (p.customerId !== undefined) out.customerId = p.customerId ?? null;
  if (p.customer !== undefined) out.customer = p.customer;
  if (p.intake !== undefined) out.intake = p.intake;
  if (p.preferredAt !== undefined) out.preferredAt = p.preferredAt ?? null;
  if (p.amount !== undefined) out.amount = p.amount;
  if (p.status !== undefined) out.status = p.status;
  if (p.paymentStatus !== undefined) out.paymentStatus = p.paymentStatus;
  if (p.paymentMethod !== undefined) out.paymentMethod = p.paymentMethod;
  if (p.payment !== undefined) out.payment = p.payment;
  if (p.scheduledAt !== undefined) out.scheduledAt = p.scheduledAt ?? null;
  if (p.adminNotes !== undefined) out.adminNotes = p.adminNotes ?? null;
  if (p.activity !== undefined) out.activity = p.activity;
  if (p.placedAt !== undefined) out.placedAt = p.placedAt;
  return out;
}

const mongoBookingRepository: BookingRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ placedAt: -1 }).lean<BookingDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<BookingDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByCustomer(customerId) {
    const M = await model();
    if (!isObjectId(customerId)) return [];
    const docs = await M.find({ customerId, ...notDeleted }).sort({ placedAt: -1 }).lean<BookingDoc[]>();
    return docs.map(fromDoc);
  },
  async findByRazorpayOrderId(rzpId) {
    const M = await model();
    const doc = await M.findOne({ "payment.razorpayOrderId": rzpId, ...notDeleted }).lean<BookingDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(booking) {
    const M = await model();
    const created = await M.create(toDoc(booking));
    return fromDoc(created.toObject() as BookingDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<BookingDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<BookingDoc>();
    return Boolean(res);
  },
};

export function getBookingRepository(): BookingRepository {
  switch (dataSourceFor("bookings")) {
    case "mongo":
      return mongoBookingRepository;
    case "mock":
    default:
      return mockBookingRepository;
  }
}
