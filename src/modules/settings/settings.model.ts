import "server-only";

/**
 * StoreSettings — Mongoose model. Settings is a single config document (one
 * row). Its shape is large and nested (general, shipping, tax, seo, email…),
 * so we store the whole validated object under a flexible `data` field and
 * keep a fixed `_id`. The zod schema in the service layer is the real shape
 * guard; here we just persist it.
 */

import { Schema, model, models, type Model } from "mongoose";
import type { StoreSettings } from "./settings.types";

const SettingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  {
    collection: "settings",
    timestamps: true,
    versionKey: false,
    _id: false,
    minimize: false,
  },
);

export interface SettingsDoc {
  _id: string;
  data: StoreSettings;
}

export const SettingsModel: Model<SettingsDoc> =
  (models.StoreSettings as Model<SettingsDoc>) ??
  model<SettingsDoc>("StoreSettings", SettingsSchema);
