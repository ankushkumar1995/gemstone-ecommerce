import type { Coupon } from "@/modules/coupons/coupon.types";

/** Mock coupon seed. Also loaded into Mongo by the seed script. */

const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const coupons: Coupon[] = [
  {
    id: "cpn_welcome",
    code: "WELCOME10",
    description: "10% off your first order",
    type: "percentage",
    value: 10,
    minCartValue: 2000,
    maxDiscount: 3000,
    usageLimit: 0,
    perCustomerLimit: 1,
    usedCount: 42,
    redemptions: [],
    expiresAt: daysFromNow(60),
    active: true,
    isPublic: true,
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
    perCustomerLimit: 0,
    usedCount: 12,
    redemptions: [],
    expiresAt: daysFromNow(30),
    active: true,
    isPublic: true,
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
    perCustomerLimit: 0,
    usedCount: 210,
    redemptions: [],
    expiresAt: daysFromNow(-5),
    active: true,
    isPublic: true,
    createdAt: new Date().toISOString(),
  },
];
