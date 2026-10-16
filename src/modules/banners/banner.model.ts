import "server-only";

/**
 * Banner — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • `placement` (hero | promo | strip) + `order` decide where/when it shows.
 *  • Optional active window (startsAt / endsAt) + `active` flag.
 *  • Soft delete so storefront references stay intact.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const BannerSchema = new Schema(
  {
    placement: { type: String, enum: ["hero", "promo", "strip"], required: true, index: true },
    eyebrow: { type: String, trim: true, maxlength: 80 },
    title: { type: String, required: [true, "title is required"], trim: true, minlength: 1, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 500 },
    image: { type: String, trim: true },
    ctaLabel: { type: String, trim: true, maxlength: 60 },
    ctaHref: { type: String, trim: true, maxlength: 400 },
    order: { type: Number, default: 0, index: true },
    active: { type: Boolean, default: true, index: true },
    startsAt: { type: String, default: null },
    endsAt: { type: String, default: null },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "banners",
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

BannerSchema.index({ isDeleted: 1, placement: 1, active: 1, order: 1 });

export type BannerDoc = InferSchemaType<typeof BannerSchema> & { _id: Types.ObjectId };

export const BannerModel: Model<BannerDoc> =
  (models.Banner as Model<BannerDoc>) ?? model<BannerDoc>("Banner", BannerSchema);
