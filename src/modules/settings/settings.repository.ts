/**
 * Settings domain — repository. A single in-memory settings document seeded
 * with sensible defaults (mirroring the values previously hardcoded in
 * checkout). Swap for Mongo later via getSettingsRepository().
 */

import { dataSourceFor } from "@/core/config/env";
import { DEFAULT_SETTINGS } from "@/data/settings";
import type { StoreSettings } from "./settings.types";

export interface SettingsRepository {
  get(): Promise<StoreSettings>;
  update(next: StoreSettings): Promise<StoreSettings>;
}

let doc: StoreSettings = { ...DEFAULT_SETTINGS };

const mockSettingsRepository: SettingsRepository = {
  async get() {
    return { ...doc };
  },
  async update(next) {
    doc = { ...next };
    return { ...doc };
  },
};

/* ------------------------------------------------------------------ *
 * Mongo-backed repository
 *
 * Settings is a singleton config document stored under a fixed _id. On first
 * read (before anyone has saved), we fall back to the seeded defaults so the
 * storefront always has values; the first `update` persists the document.
 * ------------------------------------------------------------------ */

const SETTINGS_ID = "store";

const mongoSettingsRepository: SettingsRepository = {
  async get() {
    const { connectMongoose } = await import("@/core/db/mongoose");
    const { SettingsModel } = await import("./settings.model");
    await connectMongoose();
    const found = await SettingsModel.findById(SETTINGS_ID).lean();
    if (!found) return { ...DEFAULT_SETTINGS };
    return found.data as StoreSettings;
  },
  async update(next) {
    const { connectMongoose } = await import("@/core/db/mongoose");
    const { SettingsModel } = await import("./settings.model");
    await connectMongoose();
    await SettingsModel.findByIdAndUpdate(
      SETTINGS_ID,
      { $set: { data: next } },
      { upsert: true, new: true },
    );
    return { ...next };
  },
};

export function getSettingsRepository(): SettingsRepository {
  switch (dataSourceFor("settings")) {
    case "mongo":
      return mongoSettingsRepository;
    case "mock":
    default:
      return mockSettingsRepository;
  }
}
