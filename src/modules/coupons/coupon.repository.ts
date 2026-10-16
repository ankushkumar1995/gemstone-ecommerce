/**
 * Coupons domain — repository.
 *
 * Two implementations behind one interface:
 *  • mock  — in-memory, seeded from `data/coupons.ts`.
 *  • mongo — Mongoose model (production), soft-delete + atomic usage.
 */

import { dataSourceFor } from "@/core/config/env";
import { coupons as seed } from "@/data/coupons";
import type { Coupon, CouponRedemption } from "./coupon.types";
import type { CouponDoc } from "./coupon.model";

export interface CouponRepository {
  findAll(): Promise<Coupon[]>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  create(coupon: Coupon): Promise<Coupon>;
  update(id: string, patch: Partial<Coupon>): Promise<Coupon | null>;
  remove(id: string): Promise<boolean>;
  /**
   * Atomically record ONE redemption: `$inc usedCount` + push the ledger entry,
   * but only while the total usage limit still allows it (so concurrent
   * checkouts can't push past the cap). Returns the updated coupon or null if
   * the limit was already reached.
   */
  incrementUsage(code: string, redemption: CouponRedemption): Promise<Coupon | null>;
}

const store: Coupon[] = seed.map((c) => ({
  ...c,
  isPublic: (c as { isPublic?: boolean }).isPublic ?? false,
  redemptions: [...(c.redemptions ?? [])],
}));

const mockCouponRepository: CouponRepository = {
  async findAll() {
    return store.map((c) => ({ ...c }));
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findByCode(code) {
    const c = store.find((x) => x.code.toUpperCase() === code.toUpperCase());
    return c ? { ...c } : null;
  },
  async create(coupon) {
    store.unshift(coupon);
    return { ...coupon };
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
  async incrementUsage(code, redemption) {
    const idx = store.findIndex((x) => x.code.toUpperCase() === code.toUpperCase());
    if (idx === -1) return null;
    const c = store[idx];
    if (c.usageLimit && c.usageLimit > 0 && c.usedCount >= c.usageLimit) return null;
    store[idx] = {
      ...c,
      usedCount: c.usedCount + 1,
      redemptions: [...(c.redemptions ?? []), redemption],
    };
    return { ...store[idx] };
  },
};

/* ------------------------------------------------------------------ *
 * Mongo (Mongoose model, soft-delete aware)
 * ------------------------------------------------------------------ */
async function model() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  const { CouponModel } = await import("./coupon.model");
  await connectMongoose();
  return CouponModel;
}

const notDeleted = { isDeleted: { $ne: true } };

function isObjectId(id: string): boolean {
  return /^[a-f0-9]{24}$/i.test(id);
}

function fromDoc(doc: CouponDoc): Coupon {
  const ts = doc as unknown as { createdAt?: Date };
  return {
    id: String(doc._id),
    code: doc.code,
    description: doc.description ?? undefined,
    type: doc.type as Coupon["type"],
    value: doc.value,
    minCartValue: doc.minCartValue ?? 0,
    maxDiscount: doc.maxDiscount ?? undefined,
    usageLimit: doc.usageLimit ?? 0,
    perCustomerLimit: doc.perCustomerLimit ?? 0,
    usedCount: doc.usedCount ?? 0,
    redemptions: (doc.redemptions ?? []).map((r) => ({
      customerId: r.customerId ?? undefined,
      orderNumber: r.orderNumber ?? undefined,
      at: r.at,
    })),
    startsAt: doc.startsAt ?? undefined,
    expiresAt: doc.expiresAt ?? undefined,
    active: Boolean(doc.active),
    isPublic: Boolean((doc as unknown as { isPublic?: boolean }).isPublic),
    createdAt: ts.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function toDoc(p: Partial<Coupon>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.code !== undefined) out.code = p.code;
  if (p.description !== undefined) out.description = p.description ?? null;
  if (p.type !== undefined) out.type = p.type;
  if (p.value !== undefined) out.value = p.value;
  if (p.minCartValue !== undefined) out.minCartValue = p.minCartValue;
  if (p.maxDiscount !== undefined) out.maxDiscount = p.maxDiscount ?? null;
  if (p.usageLimit !== undefined) out.usageLimit = p.usageLimit ?? 0;
  if (p.perCustomerLimit !== undefined) out.perCustomerLimit = p.perCustomerLimit ?? 0;
  if (p.usedCount !== undefined) out.usedCount = p.usedCount;
  if (p.redemptions !== undefined) out.redemptions = p.redemptions;
  if (p.startsAt !== undefined) out.startsAt = p.startsAt ?? null;
  if (p.expiresAt !== undefined) out.expiresAt = p.expiresAt ?? null;
  if (p.active !== undefined) out.active = p.active;
  if (p.isPublic !== undefined) out.isPublic = p.isPublic;
  return out;
}

const mongoCouponRepository: CouponRepository = {
  async findAll() {
    const M = await model();
    const docs = await M.find(notDeleted).sort({ createdAt: -1 }).lean<CouponDoc[]>();
    return docs.map(fromDoc);
  },
  async findById(id) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOne({ _id: id, ...notDeleted }).lean<CouponDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async findByCode(code) {
    const M = await model();
    const doc = await M.findOne({ code: code.toUpperCase(), ...notDeleted }).lean<CouponDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async create(coupon) {
    const M = await model();
    const created = await M.create(toDoc(coupon));
    return fromDoc(created.toObject() as CouponDoc);
  },
  async update(id, patch) {
    const M = await model();
    if (!isObjectId(id)) return null;
    const doc = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: toDoc(patch) },
      { new: true, runValidators: true },
    ).lean<CouponDoc>();
    return doc ? fromDoc(doc) : null;
  },
  async remove(id) {
    const M = await model();
    if (!isObjectId(id)) return false;
    const res = await M.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    ).lean<CouponDoc>();
    return Boolean(res);
  },
  async incrementUsage(code, redemption) {
    const M = await model();
    // Atomic + race-safe: only match when the usage limit still allows one more
    // (either unlimited, or usedCount < usageLimit), then $inc + push in one op.
    const doc = await M.findOneAndUpdate(
      {
        code: code.toUpperCase(),
        ...notDeleted,
        $or: [{ usageLimit: { $lte: 0 } }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
      },
      { $inc: { usedCount: 1 }, $push: { redemptions: redemption } },
      { new: true },
    ).lean<CouponDoc>();
    return doc ? fromDoc(doc) : null;
  },
};

export function getCouponRepository(): CouponRepository {
  switch (dataSourceFor("coupons")) {
    case "mongo":
      return mongoCouponRepository;
    case "mock":
    default:
      return mockCouponRepository;
  }
}
