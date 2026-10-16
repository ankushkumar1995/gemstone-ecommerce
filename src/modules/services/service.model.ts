import "server-only";

/**
 * AstroService — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId (Mongo-generated); the app sees a string `id`
 *    via the repository mapper — we never store our own string ids.
 *  • `status` controls storefront visibility; `order` drives display order.
 *  • Validation enforced at the DB layer (required, enum, min).
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ServiceSchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, "slug is required"],
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      match: [SLUG_RE, "slug must be lowercase words separated by single hyphens"],
    },
    title: { type: String, required: [true, "title is required"], trim: true, minlength: 2, maxlength: 120 },
    tagline: { type: String, default: "", trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 4000 },
    icon: { type: String, default: "Sparkles", trim: true, maxlength: 60 },
    priceFrom: { type: Number, default: 0, min: [0, "price cannot be negative"] },
    duration: { type: String, default: "30 min", trim: true, maxlength: 40 },
    popular: { type: Boolean, default: false },
    features: { type: [String], default: [] },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    order: { type: Number, default: 0, index: true },
  },
  {
    collection: "services",
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

ServiceSchema.index({ slug: 1 }, { unique: true });
ServiceSchema.index({ status: 1, order: 1 });

export type ServiceDoc = InferSchemaType<typeof ServiceSchema> & { _id: Types.ObjectId };

export const ServiceModel: Model<ServiceDoc> =
  (models.Service as Model<ServiceDoc>) ?? model<ServiceDoc>("Service", ServiceSchema);
