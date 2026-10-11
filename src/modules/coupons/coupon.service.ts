/**
 * Coupons domain — service. Admin CRUD + the shared validate/record logic the
 * checkout and order flow depend on.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import { getCouponRepository } from "./coupon.repository";
import type { Coupon, CouponValidation } from "./coupon.types";
import type { CreateCouponDto, UpdateCouponDto } from "./coupon.schema";

/** Compute the discount a coupon yields for a given subtotal. */
function computeDiscount(coupon: Coupon, subtotal: number): number {
  let discount =
    coupon.type === "percentage" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.type === "percentage" && coupon.maxDiscount && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  // never discount more than the cart itself
  return Math.min(discount, subtotal);
}

/** Check whether a coupon is currently usable (window, limit, active). */
function usabilityError(coupon: Coupon, subtotal: number): string | null {
  if (!coupon.active) return "This coupon is no longer active";
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return "This coupon isn't active yet";
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return "This coupon has expired";
  if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
    return "This coupon has reached its usage limit";
  if (subtotal < coupon.minCartValue)
    return `Add ₹${coupon.minCartValue - subtotal} more to use this coupon`;
  return null;
}

export const couponService = {
  async list(): Promise<Result<Coupon[]>> {
    const repo = getCouponRepository();
    return ok(await repo.findAll());
  },

  async getById(id: string): Promise<Result<Coupon>> {
    const repo = getCouponRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Coupon not found"));
    return ok(c);
  },

  async create(dto: CreateCouponDto): Promise<Result<Coupon>> {
    const repo = getCouponRepository();
    const code = dto.code.trim().toUpperCase();
    if (await repo.findByCode(code)) {
      return fail(AppErrors.validation("A coupon with this code already exists"));
    }
    const coupon: Coupon = {
      id: newId("cpn"),
      code,
      description: dto.description?.trim() || undefined,
      type: dto.type,
      value: dto.value,
      minCartValue: dto.minCartValue ?? 0,
      maxDiscount: dto.maxDiscount || undefined,
      usageLimit: dto.usageLimit || undefined,
      usedCount: 0,
      startsAt: dto.startsAt || undefined,
      expiresAt: dto.expiresAt || undefined,
      active: dto.active ?? true,
      createdAt: new Date().toISOString(),
    };
    const createdCoupon = await repo.create(coupon);
    await auditService.record({
      action: "create",
      entity: "coupon",
      entityId: createdCoupon.id,
      entityLabel: createdCoupon.code,
      summary: `Created coupon ${createdCoupon.code}`,
    });
    return ok(createdCoupon);
  },

  async update(id: string, dto: UpdateCouponDto): Promise<Result<Coupon>> {
    const repo = getCouponRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Coupon not found"));

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const clash = await repo.findByCode(dto.code);
      if (clash && clash.id !== id) {
        return fail(AppErrors.validation("A coupon with this code already exists"));
      }
    }

    const patch: Partial<Coupon> = {
      ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }),
      ...(dto.description !== undefined && { description: dto.description || undefined }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: dto.value }),
      ...(dto.minCartValue !== undefined && { minCartValue: dto.minCartValue }),
      ...(dto.maxDiscount !== undefined && { maxDiscount: dto.maxDiscount || undefined }),
      ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit || undefined }),
      ...(dto.startsAt !== undefined && { startsAt: dto.startsAt || undefined }),
      ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt || undefined }),
      ...(dto.active !== undefined && { active: dto.active }),
    };

    const updated = await repo.update(id, patch);
    if (!updated) return fail(AppErrors.notFound("Coupon not found"));
    await auditService.record({
      action: "update",
      entity: "coupon",
      entityId: updated.id,
      entityLabel: updated.code,
      summary: `Updated coupon ${updated.code}`,
    });
    return ok(updated);
  },

  async remove(id: string): Promise<Result<{ id: string }>> {
    const repo = getCouponRepository();
    const existing = await repo.findById(id);
    const removed = await repo.remove(id);
    if (!removed) return fail(AppErrors.notFound("Coupon not found"));
    await auditService.record({
      action: "delete",
      entity: "coupon",
      entityId: id,
      entityLabel: existing?.code,
      summary: `Deleted coupon ${existing?.code ?? id}`,
    });
    return ok({ id });
  },

  /**
   * Validate a code against a cart subtotal. Used by the storefront checkout
   * to show the discount before placing the order.
   */
  async validate(code: string, subtotal: number): Promise<Result<CouponValidation>> {
    const repo = getCouponRepository();
    const coupon = await repo.findByCode(code);
    if (!coupon) return fail(AppErrors.notFound("Invalid coupon code"));

    const err = usabilityError(coupon, subtotal);
    if (err) return fail(AppErrors.validation(err));

    const discount = computeDiscount(coupon, subtotal);
    return ok({ code: coupon.code, discount, type: coupon.type, value: coupon.value });
  },

  /**
   * Record a redemption (called by the order flow when an order with a coupon
   * is confirmed). Re-validates then increments usedCount. No-op if invalid.
   */
  async recordUsage(code: string, subtotal: number): Promise<void> {
    const repo = getCouponRepository();
    const coupon = await repo.findByCode(code);
    if (!coupon) return;
    if (usabilityError(coupon, subtotal)) return;
    await repo.update(coupon.id, { usedCount: coupon.usedCount + 1 });
  },
};
