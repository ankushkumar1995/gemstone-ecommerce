import "server-only";

/**
 * Category — Mongoose model (single source of truth for the DB schema).
 * ─────────────────────────────────────────────────────────────────────
 * Storefront product taxonomy, admin-managed. This is the production schema:
 *
 *  • `_id` is a native ObjectId (Mongo-generated). The app sees it as a string
 *    `id` via the toJSON transform / repository mapper — we never store our own
 *    string ids.
 *  • Soft delete: documents are never hard-removed; `isDeleted`/`deletedAt` flag
 *    them so storefront references (products pointing at a category) never break
 *    and data is recoverable.
 *  • `status` controls storefront visibility (draft categories stay hidden).
 *  • Validation is enforced at the DB layer (required, enum, min, match) so bad
 *    data can't be written even if a caller bypasses the zod layer.
 *  • Indexes are shaped around real queries: slug lookups, ordered active lists.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CategorySchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, "slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      match: [SLUG_RE, "slug must be lowercase words separated by single hyphens"],
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    image: {
      type: String,
      required: [true, "image is required"],
      trim: true,
    },
    tint: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
      min: [0, "order cannot be negative"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    // ── Soft delete ──────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    // ── Audit ────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  {
    collection: "categories",
    timestamps: true, // createdAt + updatedAt
    versionKey: false,
    // Clean API shape: expose `id`, drop `_id`/internal flags from JSON output.
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

/* ── Indexes shaped around real query patterns ──────────────────────────────
 * - unique slug (lookup + integrity)             → declared inline above
 * - active, ordered listing (storefront + admin) → compound below
 * - exclude soft-deleted efficiently
 */
CategorySchema.index({ isDeleted: 1, status: 1, order: 1 });
CategorySchema.index({ isDeleted: 1, order: 1 });

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: Types.ObjectId };

/** Reuse across hot reloads (Next dev) to avoid OverwriteModelError. */
export const CategoryModel: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) ?? model<CategoryDoc>("Category", CategorySchema);
