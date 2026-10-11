/** Coupons module — public API. */
export { couponController } from "./coupon.controller";
export { couponService } from "./coupon.service";
export {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  type CreateCouponDto,
  type UpdateCouponDto,
  type ApplyCouponDto,
} from "./coupon.schema";
export type { Coupon, CouponType, CouponValidation } from "./coupon.types";
