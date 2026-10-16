import "server-only";

/**
 * Coupon — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • `code` is unique (uppercase) among non-deleted docs.
 *  • Usage is tracked two ways: a denormalised `usedCount` (bumped atomically
 *    with $inc so concurrent checkouts can't over-redeem) and a `redemptions`
 *    ledger (customerId + timestamp) that powers per-customer limits.
 *  • Soft delete so historical orders referencing a coupon stay intact.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const RedemptionSchema = new Schema(
  {
    customerId: { type: String, default: null },
    orderNumber: { type: String, default: null },
    at: { type: String, required: true },
  },
  { _id: false },
);

const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, "code is required"],
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
      match: [/^[A-Z0-9][A-Z0-9_-]*$/, "code must be letters/digits (dashes/underscores allowed)"],
    },
    description: { type: String, trim: true, maxlength: 200 },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minCartValue: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 }, // cap for % coupons (0/undefined = none)

    usageLimit: { type: Number, default: 0, min: 0 }, // total redemptions (0 = unlimited)
    perCustomerLimit: { type: Number, default: 0, min: 0 }, // per-customer (0 = unlimited)
    usedCount: { type: Number, default: 0, min: 0 },
    redemptions: { type: [RedemptionSchema], default: [] },

    startsAt: { type: String, default: null },
    expiresAt: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    /** Visible in the storefront "Available offers" list (vs secret/targeted). */
    isPublic: { type: Boolean, default: false, index: true },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "coupons",
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

CouponSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CouponSchema.index({ isDeleted: 1, active: 1, expiresAt: 1 });

export type CouponDoc = InferSchemaType<typeof CouponSchema> & { _id: Types.ObjectId };

export const CouponModel: Model<CouponDoc> =
  (models.Coupon as Model<CouponDoc>) ?? model<CouponDoc>("Coupon", CouponSchema);
