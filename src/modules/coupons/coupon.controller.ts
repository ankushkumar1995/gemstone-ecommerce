/**
 * Coupons domain — controller. Validates input and bridges HTTP ⇄ service.
 */

import type { NextResponse } from "next/server";
import { parse } from "@/core/validation";
import { toResponse, type ApiResponse } from "@/core/http";
import {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  toggleCouponSchema,
} from "./coupon.schema";
import { couponService } from "./coupon.service";
import type { Coupon, CouponValidation, PublicCoupon } from "./coupon.types";

export const couponController = {
  async list(): Promise<NextResponse<ApiResponse<Coupon[]>>> {
    return toResponse(await couponService.list());
  },

  async get(id: string): Promise<NextResponse<ApiResponse<Coupon>>> {
    return toResponse(await couponService.getById(id));
  },

  async create(body: unknown): Promise<NextResponse<ApiResponse<Coupon>>> {
    const parsed = parse(createCouponSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await couponService.create(parsed.value), 201);
  },

  async update(id: string, body: unknown): Promise<NextResponse<ApiResponse<Coupon>>> {
    const parsed = parse(updateCouponSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await couponService.update(id, parsed.value));
  },

  async remove(id: string): Promise<NextResponse<ApiResponse<{ id: string }>>> {
    return toResponse(await couponService.remove(id));
  },

  async toggle(id: string, body: unknown): Promise<NextResponse<ApiResponse<Coupon>>> {
    const parsed = parse(toggleCouponSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(await couponService.toggleActive(id, parsed.value.active));
  },

  async apply(body: unknown): Promise<NextResponse<ApiResponse<CouponValidation>>> {
    const parsed = parse(applyCouponSchema, body);
    if (!parsed.ok) return toResponse(parsed);
    return toResponse(
      await couponService.validate(parsed.value.code, parsed.value.cartSubtotal, parsed.value.customerId),
    );
  },

  /** Storefront "Available offers" — public coupons with eligibility. */
  async available(subtotal: number, customerId?: string): Promise<NextResponse<ApiResponse<PublicCoupon[]>>> {
    return toResponse(await couponService.listPublic(subtotal, customerId));
  },
};
