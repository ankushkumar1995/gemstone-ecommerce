/**
 * Customers domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory, pre-seeded (used when DATA_SOURCE_CUSTOMERS != mongo).
 *  • mongo — Mongoose model (production), soft-delete aware.
 *
 * Switch per-module with DATA_SOURCE_CUSTOMERS=mongo once customers are seeded.
 */

import { dataSourceFor } from "@/core/config/env";
import { customers as seed } from "@/data/customers";
import type { Customer } from "./customer.types";
import type { CustomerDoc } from "./customer.model";

export interface CustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  create(customer: Customer): Promise<Customer>;
  update(id: string, patch: Partial<Customer>): Promise<Customer | null>;
  remove(id: string): Promise<boolean>;
}

const store: Customer[] = seed.map((c) => ({ ...c }));

const mockCustomerRepository: CustomerRepository = {
  async findAll() {
    return store.map((c) => ({ ...c }));
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findByEmail(email) {
    const c = store.find((x) => x.email.toLowerCase() === email.toLowerCase());
    return c ? { ...c } : null;
  },
  async create(customer) {
    store.unshift(customer);
    return { ...customer };
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
  const { CustomerModel } = await import("./customer.model");
  await connectMongoose();
  return CustomerModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

/** Map a Mongoose lean doc → the app's Customer shape. */
function fromDoc(doc: CustomerDoc): Customer {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? undefined,
    avatar: doc.avatar ?? undefined,
    status: (doc.status ?? "active") as Customer["status"],
    tags: doc.tags ?? [],
    notes: doc.notes ?? undefined,
    addresses: (doc.addresses ?? []).map((a, i) => ({
      // Prefer the stored stable id; fall back to index only for legacy docs
      // written before addresses carried an id.
      id: (a as { id?: string }).id ?? `adr_${i}`,
      label: a.label ?? "",
      name: (a as { name?: string }).name || undefined,
      phone: (a as { phone?: string }).phone || undefined,
      line1: a.line1 ?? "",
      line2: a.line2 ?? undefined,
      city: a.city ?? "",
      state: a.state ?? undefined,
      postalCode: a.postalCode ?? undefined,
      country: a.country ?? "India",
      isDefault: a.isDefault ?? false,
    })),
    wishlist: ((doc as unknown as { wishlist?: string[] }).wishlist ?? []).slice(),
    totalOrders: doc.totalOrders ?? 0,
    totalSpent: doc.totalSpent ?? 0,
    lastOrderAt: doc.lastOrderAt ?? undefined,
    activity: (doc.activity ?? []).map((a) => ({
      id: a.id,
      at: a.at,
      type: a.type as Customer["activity"][number]["type"],
      message: a.message,
      actor: a.actor ?? undefined,
    })),
    createdAt:
      (doc as unknown as { createdAt?: Date }).createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

/** Map an app Customer (service output) → a Mongo document shape. */
function toDoc(p: Partial<Customer>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.email !== undefined) out.email = p.email;
  if (p.phone !== undefined) out.phone = p.phone ?? null;
  if (p.avatar !== undefined) out.avatar = p.avatar ?? null;
  if (p.status !== undefined) out.status = p.status;
  if (p.tags !== undefined) out.tags = p.tags;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  if (p.addresses !== undefined) {
    out.addresses = p.addresses.map((a) => ({
      id: a.id,
      name: a.name ?? "",
      phone: a.phone ?? "",
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault ?? false,
    }));
  }
  if (p.wishlist !== undefined) out.wishlist = p.wishlist;
  if (p.totalOrders !== undefined) out.totalOrders = p.totalOrders;
  if (p.totalSpent !== undefined) out.totalSpent = p.totalSpent;
  if (p.lastOrderAt !== undefined) out.lastOrderAt = p.lastOrderAt ?? null;
  if (p.activity !== undefined) out.activity = p.activity;
  return out;
}

const mongoCustomerRepository: CustomerRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ createdAt: -1 }).lean<CustomerDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<CustomerDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByEmail(email) {
    const M = await model();
    const doc = await M.findOne({ email: email.toLowerCase(), ...notDeleted }).lean<CustomerDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(customer) {
    const M = await model();
    const created = await M.create(toDoc(customer));
    return fromDoc(created.toObject() as CustomerDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<CustomerDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    // Soft delete so order references stay intact.
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<CustomerDoc>();
    return Boolean(res);
  },
};

export function getCustomerRepository(): CustomerRepository {
  switch (dataSourceFor("customers")) {
    case "mongo":
      return mongoCustomerRepository;
    case "mock":
    default:
      return mockCustomerRepository;
  }
}
