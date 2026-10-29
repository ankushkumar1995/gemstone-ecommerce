import "server-only";

/**
 * Popup — Mongoose model (production schema).
 * ─────────────────────────────────────────────────────────────────────
 *  • `_id` is a native ObjectId; the app sees a string `id` via toJSON.
 *  • Nested sub-documents (content, design, targeting, trigger,
 *    frequencyRule, analytics) mirror the types. `_id: false` on each so
 *    Mongoose doesn't add ids to the sub-docs.
 *  • `enabled` + `priority` + schedule window decide eligibility.
 *  • Soft delete so analytics history is never hard-lost by accident.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const CtaSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 60, default: "" },
    href: { type: String, trim: true, maxlength: 400, default: "" },
    style: { type: String, enum: ["primary", "secondary", "ghost"], default: "primary" },
  },
  { _id: false },
);

const ContentSchema = new Schema(
  {
    heading: { type: String, trim: true, default: "" },
    body: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, default: "" },
    html: { type: String, trim: true, default: "" },
    couponCode: { type: String, trim: true, default: "" },
    emailPlaceholder: { type: String, trim: true, default: "" },
    submitLabel: { type: String, trim: true, default: "" },
    successMessage: { type: String, trim: true, default: "" },
    ctas: { type: [CtaSchema], default: [] },
  },
  { _id: false },
);

const DesignSchema = new Schema(
  {
    layout: { type: String, enum: ["center", "corner", "top-bar", "bottom-bar", "fullscreen"], default: "center" },
    corner: { type: String, enum: ["bottom-right", "bottom-left", "top-right", "top-left"], default: "bottom-right" },
    width: { type: String, enum: ["sm", "md", "lg"], default: "md" },
    radius: { type: String, enum: ["none", "soft", "round"], default: "soft" },
    imageOnly: { type: Boolean, default: false },
    accentColor: { type: String, trim: true, default: "" },
    backgroundColor: { type: String, trim: true, default: "" },
    textColor: { type: String, trim: true, default: "" },
    overlay: { type: Boolean, default: true },
    showClose: { type: Boolean, default: true },
    closeOnOverlayClick: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true },
  },
  { _id: false },
);

const TargetingSchema = new Schema(
  {
    pageMode: { type: String, enum: ["all", "include", "exclude"], default: "all" },
    pagePaths: { type: [String], default: [] },
    device: { type: String, enum: ["all", "desktop", "mobile"], default: "all" },
    audience: { type: String, enum: ["all", "new", "returning"], default: "all" },
    auth: { type: String, enum: ["all", "guest", "customer"], default: "all" },
  },
  { _id: false },
);

const TriggerSchema = new Schema(
  {
    type: { type: String, enum: ["delay", "scroll", "exit-intent", "load"], default: "delay" },
    delaySeconds: { type: Number, default: 3 },
    scrollPercent: { type: Number, default: 50 },
  },
  { _id: false },
);

const FrequencySchema = new Schema(
  {
    frequency: {
      type: String,
      enum: ["once-ever", "once-per-session", "once-per-day", "once-per-n-days", "every-visit"],
      default: "once-per-session",
    },
    everyNDays: { type: Number, default: 7 },
    showAgainAfterDismissHours: { type: Number, default: 0 },
  },
  { _id: false },
);

const AnalyticsSchema = new Schema(
  {
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    dismissals: { type: Number, default: 0 },
    submissions: { type: Number, default: 0 },
  },
  { _id: false },
);

const PopupSchema = new Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true, minlength: 1, maxlength: 160 },
    type: { type: String, enum: ["promo", "newsletter", "lead", "announcement", "html"], required: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0, index: true },
    content: { type: ContentSchema, default: () => ({}) },
    design: { type: DesignSchema, default: () => ({}) },
    targeting: { type: TargetingSchema, default: () => ({}) },
    trigger: { type: TriggerSchema, default: () => ({}) },
    frequencyRule: { type: FrequencySchema, default: () => ({}) },
    analytics: { type: AnalyticsSchema, default: () => ({}) },
    startAt: { type: String, default: null },
    endAt: { type: String, default: null },

    // ── Soft delete ──
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "popups",
    timestamps: true,
    versionKey: false,
    minimize: false,
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

PopupSchema.index({ isDeleted: 1, enabled: 1, priority: -1 });

export type PopupDoc = InferSchemaType<typeof PopupSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

// In dev, Next.js hot-reloads modules but Mongoose keeps the FIRST registered
// model cached under `models.Popup`. If the schema changed since (e.g. a new
// field), the stale model silently strips the unknown field on save. So in
// development we drop the cached model and re-register with the current schema.
// In production the model is registered once, so this is a no-op there.
if (process.env.NODE_ENV !== "production" && models.Popup) {
  delete models.Popup;
}

export const PopupModel: Model<PopupDoc> =
  (models.Popup as Model<PopupDoc>) ?? model<PopupDoc>("Popup", PopupSchema);
