/**
 * Coupons domain — types. Promo codes applied at checkout.
 *
 * A coupon is either a percentage ("10% off, up to ₹2000") or a fixed amount
 * ("₹500 off"). Validation (min cart, window, usage limit, active) lives in
 * the service so both the storefront (apply at checkout) and the order flow
 * (record usage) share one source of truth.
 */

export type CouponType = "percentage" | "fixed";

/** Lifecycle status, derived server-side from window + limits + active flag. */
export type CouponStatus = "live" | "scheduled" | "expired" | "disabled" | "exhausted";

/** One redemption in the ledger (powers per-customer limits + analytics). */
export interface CouponRedemption {
  customerId?: string;
  orderNumber?: string;
  at: string; // ISO
}

export interface Coupon {
  id: string;
  code: string; // uppercase, unique — e.g. "SAVE10"
  description?: string;
  type: CouponType;
  value: number; // percent (0–100) or rupees
  minCartValue: number; // minimum subtotal to qualify (0 = none)
  maxDiscount?: number; // cap for percentage coupons (0/undefined = no cap)
  usageLimit?: number; // total redemptions allowed (0/undefined = unlimited)
  perCustomerLimit?: number; // per-customer cap (0/undefined = unlimited)
  usedCount: number;
  redemptions?: CouponRedemption[];
  startsAt?: string; // ISO — active from
  expiresAt?: string; // ISO — active until
  active: boolean; // manual on/off
  /** Show this coupon in the storefront "Available offers" list at checkout.
   *  false = secret/targeted (works only if the customer types the exact code). */
  isPublic: boolean;
  /** Derived (not stored): live | scheduled | expired | disabled | exhausted. */
  status?: CouponStatus;
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
  perCustomerLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  active?: boolean;
  isPublic?: boolean;
}

/** Result of validating a coupon against a cart subtotal. */
export interface CouponValidation {
  code: string;
  discount: number; // rupees to subtract
  type: CouponType;
  value: number;
}

/**
 * A coupon as shown in the storefront "Available offers" list. Safe subset —
 * no redemption ledger or internal counters. `eligible` tells the UI whether
 * it can be applied to the current cart (else `reason` says why not).
 */
export interface PublicCoupon {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minCartValue: number;
  maxDiscount?: number;
  expiresAt?: string;
  /** Discount (₹) this coupon would give the current cart (0 if not eligible). */
  previewDiscount: number;
  eligible: boolean;
  reason?: string; // why it can't be applied yet (e.g. min cart not met)
}
