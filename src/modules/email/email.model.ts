import "server-only";

/**
 * Email templates + logs — Mongoose models.
 * Templates: one editable message per event (unique by event when enabled).
 * Logs: a capped-ish history of send attempts for the admin log view.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const TemplateSchema = new Schema(
  {
    event: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    enabled: { type: Boolean, default: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    html: { type: String, required: true },
    text: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    collection: "email_templates",
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

const AttemptSchema = new Schema(
  {
    provider: { type: String },
    delivered: { type: Boolean, default: false },
    skipped: { type: String },
    error: { type: String },
  },
  { _id: false },
);

const LogSchema = new Schema(
  {
    event: { type: String, required: true, index: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ["delivered", "failed", "logged"], required: true, index: true },
    provider: { type: String },
    error: { type: String },
    attempts: { type: [AttemptSchema], default: [] },
  },
  {
    collection: "email_logs",
    timestamps: { createdAt: true, updatedAt: false },
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

LogSchema.index({ createdAt: -1 });

export type TemplateDoc = InferSchemaType<typeof TemplateSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export type LogDoc = InferSchemaType<typeof LogSchema> & { _id: Types.ObjectId; createdAt: Date };

// Dev: drop stale cached models so schema changes take effect without a manual
// restart (see popup.model.ts for the rationale). No-op in production.
if (process.env.NODE_ENV !== "production") {
  if (models.EmailTemplate) delete models.EmailTemplate;
  if (models.EmailLog) delete models.EmailLog;
}

export const EmailTemplateModel: Model<TemplateDoc> =
  (models.EmailTemplate as Model<TemplateDoc>) ?? model<TemplateDoc>("EmailTemplate", TemplateSchema);

export const EmailLogModel: Model<LogDoc> =
  (models.EmailLog as Model<LogDoc>) ?? model<LogDoc>("EmailLog", LogSchema);
