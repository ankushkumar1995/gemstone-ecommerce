import "server-only";

/**
 * Article (Blog) — Mongoose model (production schema, single source of truth).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • `status` (draft | published) controls storefront visibility.
 *  • Supports both legacy structured `body` blocks and rich HTML `content`.
 *  • Soft delete so storefront links / references never break.
 *  • Indexes: unique slug (non-deleted), published+date listing, category.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BlockSchema = new Schema(
  {
    type: { type: String, enum: ["p", "h2", "quote", "list"], required: true },
    text: { type: String },
    items: { type: [String], default: undefined },
  },
  { _id: false },
);

const SeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    ogImage: { type: String, trim: true },
  },
  { _id: false },
);

const ActivitySchema = new Schema(
  {
    id: { type: String, required: true },
    at: { type: String, required: true },
    type: { type: String, enum: ["created", "updated", "status", "note"], default: "note" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    actor: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const ArticleSchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, "slug is required"],
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
      match: [SLUG_RE, "slug must be lowercase words separated by single hyphens"],
    },
    title: { type: String, required: [true, "title is required"], trim: true, minlength: 2, maxlength: 200 },
    excerpt: { type: String, trim: true, maxlength: 500, default: "" },
    category: { type: String, required: [true, "category is required"], trim: true, maxlength: 80, index: true },
    readMins: { type: Number, default: 1, min: 1 },
    image: { type: String, required: [true, "image is required"], trim: true },
    author: { type: String, trim: true, maxlength: 120, default: "Astrounkle Team" },
    authorRole: { type: String, trim: true, maxlength: 120, default: "Editorial" },
    date: { type: String, required: true }, // ISO display/publish date
    tags: { type: [String], default: [], index: true },
    featured: { type: Boolean, default: false, index: true },

    body: { type: [BlockSchema], default: [] },
    content: { type: String }, // rich HTML (preferred when present)

    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    seo: { type: SeoSchema, default: undefined },
    activity: { type: [ActivitySchema], default: [] },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

    // ── Audit ──
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  {
    collection: "articles",
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

ArticleSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ArticleSchema.index({ isDeleted: 1, status: 1, date: -1 });
ArticleSchema.index({ isDeleted: 1, status: 1, category: 1, date: -1 });
ArticleSchema.index({ title: "text", excerpt: "text", tags: "text" });

export type ArticleDoc = InferSchemaType<typeof ArticleSchema> & { _id: Types.ObjectId };

export const ArticleModel: Model<ArticleDoc> =
  (models.Article as Model<ArticleDoc>) ?? model<ArticleDoc>("Article", ArticleSchema);
