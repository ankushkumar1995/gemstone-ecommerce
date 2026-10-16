import "server-only";

/**
 * Customer — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • Soft delete (`isDeleted`/`deletedAt`) so order references never break.
 *  • Email is unique among non-deleted docs (partial unique index).
 *  • Lifetime stats (totalOrders/totalSpent/lastOrderAt) are kept denormalised
 *    and updated by the orders module (recordOrder / revertOrder).
 *  • Embedded addresses + activity timeline (bounded) mirror the app shape.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AddressSchema = new Schema(
  {
    // Stable app-level id so addresses can be updated/removed/defaulted
    // reliably (never index-based — indexes shift on delete).
    id: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    label: { type: String, trim: true, maxlength: 60, default: "" },
    line1: { type: String, trim: true, maxlength: 200, default: "" },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    state: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 80, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: String, required: true },
    type: { type: String, enum: ["created", "updated", "note", "status", "order"], default: "note" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actor: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const CustomerSchema = new Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: [true, "email is required"],
      lowercase: true,
      trim: true,
      match: [EMAIL_RE, "a valid email is required"],
      maxlength: 180,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    avatar: { type: String, trim: true },
    status: { type: String, enum: ["active", "vip", "blocked"], default: "active", index: true },
    tags: { type: [String], default: [], index: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    addresses: { type: [AddressSchema], default: [] },

    /** Storefront wishlist — product ids the customer saved (bounded). */
    wishlist: { type: [String], default: [] },

    // ── Self-service auth (storefront login/signup) ─────────────────
    // All sensitive fields are select:false so they never leak via normal
    // reads; the customer-auth service explicitly selects them when needed.
    passwordHash: { type: String, select: false },
    /** "password" | "google" — how this account authenticates. */
    provider: { type: String, enum: ["password", "google"], default: "password" },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false, default: null },
    emailVerifyExpires: { type: Date, select: false, default: null },
    /** bump to invalidate ALL issued tokens (logout-everywhere / after reset). */
    tokenVersion: { type: Number, default: 0, select: false },
    /** sha256 of the current refresh token (rotation + reuse detection). */
    refreshTokenHash: { type: String, select: false, default: null },
    /** brute-force protection. */
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    /** forgot-password flow (hashed token + expiry). */
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },
    lastLoginAt: { type: Date, default: null },

    // ── Lifetime stats (denormalised; maintained by the orders module) ──
    totalOrders: { type: Number, default: 0, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    lastOrderAt: { type: String, default: null },

    // ── Activity timeline (newest first, bounded) ──
    activity: { type: [ActivitySchema], default: [] },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    // ── Audit ──
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  {
    collection: "customers",
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

/* Indexes shaped around real queries. */
CustomerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CustomerSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ name: "text", email: "text" });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: Types.ObjectId };

export const CustomerModel: Model<CustomerDoc> =
  (models.Customer as Model<CustomerDoc>) ?? model<CustomerDoc>("Customer", CustomerSchema);
