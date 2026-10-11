/**
 * Coupons domain — repository. Mock in-memory store, seeded with a couple of
 * promo codes. Swap for Mongo later via getCouponRepository().
 */

import { env } from "@/core/config/env";
import type { Coupon } from "./coupon.types";

export interface CouponRepository {
  findAll(): Promise<Coupon[]>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  create(coupon: Coupon): Promise<Coupon>;
  update(id: string, patch: Partial<Coupon>): Promise<Coupon | null>;
  remove(id: string): Promise<boolean>;
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

const store: Coupon[] = [
  {
    id: "cpn_welcome",
    code: "WELCOME10",
    description: "10% off your first order",
    type: "percentage",
    value: 10,
    minCartValue: 2000,
    maxDiscount: 3000,
    usageLimit: 0,
    usedCount: 42,
    expiresAt: daysFromNow(60),
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cpn_flat500",
    code: "FLAT500",
    description: "₹500 off orders above ₹10,000",
    type: "fixed",
    value: 500,
    minCartValue: 10000,
    usageLimit: 100,
    usedCount: 12,
    expiresAt: daysFromNow(30),
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "cpn_diwali",
    code: "DIWALI25",
    description: "Festive 25% off (expired)",
    type: "percentage",
    value: 25,
    minCartValue: 5000,
    maxDiscount: 8000,
    usageLimit: 0,
    usedCount: 210,
    expiresAt: daysFromNow(-5),
    active: true,
    createdAt: new Date().toISOString(),
  },
];

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
};

export function getCouponRepository(): CouponRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo coupon repository not implemented yet");
    case "mock":
    default:
      return mockCouponRepository;
  }
}
