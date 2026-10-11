/**
 * Coupons domain — types. Promo codes applied at checkout.
 *
 * A coupon is either a percentage ("10% off, up to ₹2000") or a fixed amount
 * ("₹500 off"). Validation (min cart, window, usage limit, active) lives in
 * the service so both the storefront (apply at checkout) and the order flow
 * (record usage) share one source of truth.
 */

export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: string;
  code: string; // uppercase, unique — e.g. "SAVE10"
  description?: string;
  type: CouponType;
  value: number; // percent (0–100) or rupees
  minCartValue: number; // minimum subtotal to qualify (0 = none)
  maxDiscount?: number; // cap for percentage coupons (0/undefined = no cap)
  usageLimit?: number; // total redemptions allowed (0/undefined = unlimited)
  usedCount: number;
  startsAt?: string; // ISO — active from
  expiresAt?: string; // ISO — active until
  active: boolean; // manual on/off
  createdAt: string;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minCartValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  active?: boolean;
}

/** Result of validating a coupon against a cart subtotal. */
export interface CouponValidation {
  code: string;
  discount: number; // rupees to subtract
  type: CouponType;
  value: number;
}
