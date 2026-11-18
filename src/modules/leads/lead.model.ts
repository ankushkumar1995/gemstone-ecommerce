import "server-only";

/**
 * Lead — Mongoose model. Every enquiry from the storefront (contact form,
 * service enquiry, consultation request, newsletter) is stored here so it
 * survives restarts and deploys.
 *
 * Validation mirrors the zod layer so bad data can't be written even if a
 * caller bypasses it. Indexes match the admin's real queries: newest first,
 * filtered by status or source.
 */

import { Schema, model, models, type Model, type InferSchemaType, type Types } from "mongoose";

const LeadSchema = new Schema(
  {
    source: {
      type: String,
      required: true,
      enum: ["contact", "service", "newsletter", "consultation"],
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    topic: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 5000 },
    birth: {
      type: new Schema(
        {
          date: { type: String, trim: true, maxlength: 40 },
          time: { type: String, trim: true, maxlength: 40 },
          place: { type: String, trim: true, maxlength: 200 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    gender: { type: String, enum: ["male", "female", "other"] },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed", "separated"],
    },
    astrologer: { type: String, trim: true, maxlength: 120 },
    status: {
      type: String,
      required: true,
      enum: ["new", "contacted", "converted", "closed"],
      default: "new",
    },
  },
  {
    collection: "leads",
    timestamps: true, // createdAt + updatedAt
    versionKey: false,
  },
);

LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });

export type LeadDoc = InferSchemaType<typeof LeadSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/** Reuse across hot reloads (Next dev) to avoid OverwriteModelError. */
export const LeadModel: Model<LeadDoc> =
  (models.Lead as Model<LeadDoc>) ?? model<LeadDoc>("Lead", LeadSchema);
