import "server-only";

/**
 * astro_profiles — birth details used for kundli, horoscope and remedies.
 *
 * Stored per customer on the server so they follow the account, not the phone:
 * sign out / reinstall / new phone / website all see the same details.
 * One row per person; `isPrimary` marks the account holder (exactly one per
 * customer, enforced by a partial unique index). Family members can be added
 * later as non-primary rows without a schema change.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

const AstroProfileSchema = new Schema(
  {
    customerId: { type: String, required: true },
    isPrimary: { type: Boolean, required: true, default: false },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    /** yyyy-mm-dd (calendar date, no timezone). */
    dob: { type: String, required: true },
    /** HH:mm, 24h. */
    birthTime: { type: String, required: true },
    timeAccuracy: { type: String, required: true, enum: ["exact", "approximate", "unknown"] },
    gender: { type: String, required: true, enum: ["male", "female", "other"] },
    birthPlace: { type: String, required: true, trim: true, maxlength: 200 },
    language: { type: String, required: true, enum: ["English", "Hindi", "Hinglish"], default: "English" },
    interests: { type: [String], default: [] },
    /** Which client last wrote it (debugging sync issues). */
    source: { type: String, enum: ["web", "android", "ios"], default: "web" },
  },
  { collection: "astro_profiles", versionKey: false, timestamps: true },
);
AstroProfileSchema.index({ customerId: 1, isPrimary: -1, updatedAt: -1 });
AstroProfileSchema.index({ customerId: 1 }, { unique: true, partialFilterExpression: { isPrimary: true }, name: "primary_per_customer" });

if (process.env.NODE_ENV !== "production" && models.AstroProfile) deleteModel("AstroProfile");
export const AstroProfileModel: Model<Record<string, unknown>> =
  (models.AstroProfile as Model<Record<string, unknown>>) ?? model("AstroProfile", AstroProfileSchema);
