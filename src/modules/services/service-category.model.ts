import "server-only";

/** Service categories — Mongoose model. Name (case-insensitive) and slug are unique. */

import { Schema, model, models, type Model } from "mongoose";

const ServiceCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    nameLower: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 70 },
    icon: { type: String, default: "Sparkles", maxlength: 60 },
    description: { type: String, default: "", maxlength: 300 },
    visible: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { collection: "service_categories", timestamps: true, versionKey: false },
);

type Doc = Record<string, unknown>;
export const ServiceCategoryModel: Model<Doc> = (models.ServiceCategory as Model<Doc>) ?? model<Doc>("ServiceCategory", ServiceCategorySchema);
