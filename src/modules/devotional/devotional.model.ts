import "server-only";

/**
 *  devotional_items  mantras, aarti, chalisa, stotra, katha, bhajan (admin managed)
 *  devotional_jaap   one row per jaap update from a signed-in customer
 *                    (clientId makes a retried send a no-op)
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";

type AnyDoc = Record<string, unknown>;
const Mixed = Schema.Types.Mixed;

const ItemSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    kind: { type: String, required: true, index: true },
    status: { type: String, default: "draft", index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    titleHi: { type: String, default: "", trim: true, maxlength: 200 },
    deity: { type: String, default: "", trim: true, maxlength: 60, index: true },
    devanagari: { type: String, default: "", maxlength: 4000 },
    roman: { type: String, default: "", maxlength: 4000 },
    meaning: { type: Mixed, default: () => ({ en: "", hi: "" }) },
    blurb: { type: String, default: "", maxlength: 300 },
    verses: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    bestTime: { type: String, default: "", maxlength: 160 },
    days: { type: [Number], default: [] },
    planets: { type: [String], default: [] },
    festivals: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    defaultCount: { type: Number, default: 11 },
    recitationSec: { type: Number, default: 30 },
    audio: { type: Mixed, default: null },
    image: { type: String, default: null },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 100 },
    plays: { type: Number, default: 0 },
    jaapCount: { type: Number, default: 0 },
    updatedBy: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { collection: "devotional_items", timestamps: true, versionKey: false },
);
ItemSchema.index({ status: 1, kind: 1, order: 1 });

const JaapSchema = new Schema(
  {
    customerId: { type: String, required: true },
    clientId: { type: String, required: true },
    itemSlug: { type: String, required: true },
    count: { type: Number, required: true },
    /** IST calendar day (YYYY-MM-DD) for streaks. */
    day: { type: String, required: true },
    at: { type: String, required: true },
  },
  { collection: "devotional_jaap", versionKey: false },
);
JaapSchema.index({ customerId: 1, clientId: 1 }, { unique: true });
JaapSchema.index({ customerId: 1, day: -1 });

if (process.env.NODE_ENV !== "production") {
  for (const n of ["DevotionalItem", "DevotionalJaap"]) if (models[n]) deleteModel(n);
}

export const DevotionalItemModel: Model<AnyDoc> = (models.DevotionalItem as Model<AnyDoc>) ?? model<AnyDoc>("DevotionalItem", ItemSchema);
export const DevotionalJaapModel: Model<AnyDoc> = (models.DevotionalJaap as Model<AnyDoc>) ?? model<AnyDoc>("DevotionalJaap", JaapSchema);
