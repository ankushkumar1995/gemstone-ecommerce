/**
 * Coupons domain — service. Admin CRUD + the shared validate/record logic the
 * checkout and order flow depend on.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { auditService } from "@/modules/audit";
import { getCouponRepository } from "./coupon.repository";
import type { Coupon, CouponStatus, CouponValidation, PublicCoupon } from "./coupon.types";
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

/** Derive the lifecycle status (not stored) from window + limits + active. */
function deriveStatus(coupon: Coupon): CouponStatus {
  if (!coupon.active) return "disabled";
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return "scheduled";
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return "expired";
  if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
    return "exhausted";
  return "live";
}

/** Attach the derived status to a coupon for API responses. */
function withStatus(coupon: Coupon): Coupon {
  return { ...coupon, status: deriveStatus(coupon) };
}

/** How many times a given customer has already redeemed this coupon. */
function timesUsedBy(coupon: Coupon, customerId?: string): number {
  if (!customerId) return 0;
  return (coupon.redemptions ?? []).filter((r) => r.customerId === customerId).length;
}

/**
 * Check whether a coupon is currently usable (window, limits, active, per-
 * customer limit). `customerId` is optional (guest checkout).
 */
function usabilityError(coupon: Coupon, subtotal: number, customerId?: string): string | null {
  if (!coupon.active) return "This coupon is no longer active";
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return "This coupon isn't active yet";
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return "This coupon has expired";
  if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit)
    return "This coupon has reached its usage limit";
  if (
    coupon.perCustomerLimit &&
    coupon.perCustomerLimit > 0 &&
    timesUsedBy(coupon, customerId) >= coupon.perCustomerLimit
  )
    return "You've already used this coupon the maximum number of times";
  if (subtotal < coupon.minCartValue)
    return `Add ₹${(coupon.minCartValue - subtotal).toLocaleString("en-IN")} more to use this coupon`;
  return null;
}

export const couponService = {
  async list(): Promise<Result<Coupon[]>> {
    const repo = getCouponRepository();
    const all = await repo.findAll();
    return ok(all.map(withStatus));
  },

  async getById(id: string): Promise<Result<Coupon>> {
    const repo = getCouponRepository();
    const c = await repo.findById(id);
    if (!c) return fail(AppErrors.notFound("Coupon not found"));
    return ok(withStatus(c));
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
      perCustomerLimit: dto.perCustomerLimit || undefined,
      usedCount: 0,
      redemptions: [],
      startsAt: dto.startsAt || undefined,
      expiresAt: dto.expiresAt || undefined,
      active: dto.active ?? true,
      isPublic: dto.isPublic ?? false,
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
      ...(dto.perCustomerLimit !== undefined && { perCustomerLimit: dto.perCustomerLimit || undefined }),
      ...(dto.startsAt !== undefined && { startsAt: dto.startsAt || undefined }),
      ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt || undefined }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
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
    return ok(withStatus(updated));
  },

  /** Quick enable/disable toggle (admin). */
  async toggleActive(id: string, active: boolean): Promise<Result<Coupon>> {
    const repo = getCouponRepository();
    const existing = await repo.findById(id);
    if (!existing) return fail(AppErrors.notFound("Coupon not found"));
    const updated = await repo.update(id, { active });
    if (!updated) return fail(AppErrors.notFound("Coupon not found"));
    await auditService.record({
      action: "update",
      entity: "coupon",
      entityId: updated.id,
      entityLabel: updated.code,
      summary: `${active ? "Enabled" : "Disabled"} coupon ${updated.code}`,
    });
    return ok(withStatus(updated));
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
  async validate(code: string, subtotal: number, customerId?: string): Promise<Result<CouponValidation>> {
    const repo = getCouponRepository();
    const coupon = await repo.findByCode(code);
    if (!coupon) return fail(AppErrors.notFound("Invalid coupon code"));

    const err = usabilityError(coupon, subtotal, customerId);
    if (err) return fail(AppErrors.validation(err));

    const discount = computeDiscount(coupon, subtotal);
    return ok({ code: coupon.code, discount, type: coupon.type, value: coupon.value });
  },

  /**
   * Storefront "Available offers" — the PUBLIC coupons the shopper can see and
   * one-tap apply at checkout. Secret/targeted coupons (isPublic=false) are
   * NEVER listed here; they still work if the exact code is typed.
   *
   * Each entry carries an eligibility check against the current cart subtotal
   * so the UI can show "Apply" vs a reason (e.g. "Add ₹X more"). Expired/
   * disabled/exhausted/not-yet-started coupons are filtered out entirely.
   */
  async listPublic(subtotal: number, customerId?: string): Promise<Result<PublicCoupon[]>> {
    const repo = getCouponRepository();
    const all = await repo.findAll();
    const now = Date.now();

    const visible = all.filter((c) => {
      if (!c.isPublic) return false;
      if (!c.active) return false;
      // hide not-yet-started, expired, and fully-exhausted coupons
      if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
      if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return false;
      if (c.usageLimit && c.usageLimit > 0 && c.usedCount >= c.usageLimit) return false;
      return true;
    });

    const out: PublicCoupon[] = visible.map((c) => {
      const err = usabilityError(c, subtotal, customerId);
      const eligible = err === null;
      return {
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        minCartValue: c.minCartValue,
        maxDiscount: c.maxDiscount,
        expiresAt: c.expiresAt,
        previewDiscount: eligible ? computeDiscount(c, subtotal) : 0,
        eligible,
        reason: err ?? undefined,
      };
    });

    // Best savings first, but eligible ones ahead of ineligible.
    out.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.previewDiscount - a.previewDiscount;
    });
    return ok(out);
  },

  /**
   * Record a redemption (called by the order flow when an order with a coupon
   * is confirmed). Re-validates, then atomically increments usage + appends a
   * ledger entry. The atomic increment is race-safe against the usage limit.
   * No-op if invalid or the limit was reached concurrently.
   */
  async recordUsage(
    code: string,
    subtotal: number,
    opts?: { customerId?: string; orderNumber?: string },
  ): Promise<void> {
    const repo = getCouponRepository();
    const coupon = await repo.findByCode(code);
    if (!coupon) return;
    if (usabilityError(coupon, subtotal, opts?.customerId)) return;
    await repo.incrementUsage(code, {
      customerId: opts?.customerId,
      orderNumber: opts?.orderNumber,
      at: new Date().toISOString(),
    });
  },
};
