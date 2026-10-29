/**
 * Settings domain — service. Reads the single settings document and applies
 * partial, per-section updates (deep merge) so a tab can be saved alone.
 */

import { ok, type Result } from "@/core/result";
import { newId } from "@/core/id";
import { getSettingsRepository } from "./settings.repository";
import type { StoreSettings } from "./settings.types";
import type { UpdateSettingsDto } from "./settings.schema";
import { DEFAULT_GLOBAL_CONFIGURATOR } from "@/modules/configurator";

export const settingsService = {
  async get(): Promise<Result<StoreSettings>> {
    const repo = getSettingsRepository();
    const current = await repo.get();
    // Always surface a configurator config so the PDP/server never see undefined.
    if (!current.configurator) {
      current.configurator = DEFAULT_GLOBAL_CONFIGURATOR;
    }
    return ok(current);
  },

  async update(dto: UpdateSettingsDto): Promise<Result<StoreSettings>> {
    const repo = getSettingsRepository();
    const current = await repo.get();

    // shipping zones: ensure every zone has a stable id
    const shipping: StoreSettings["shipping"] = {
      ...current.shipping,
      ...(dto.shipping ?? {}),
      zones: dto.shipping?.zones
        ? dto.shipping.zones.map((z) => ({ ...z, id: z.id ?? newId("zone") }))
        : current.shipping.zones,
    };

    // team members: ensure every member has a stable id
    const team: StoreSettings["team"] = {
      ...current.team,
      ...(dto.team ?? {}),
      members: dto.team?.members
        ? dto.team.members.map((m) => ({ ...m, id: m.id ?? newId("tm") }))
        : current.team.members,
    };

    const next: StoreSettings = {
      general: { ...current.general, ...(dto.general ?? {}) },
      shipping,
      tax: { ...current.tax, ...(dto.tax ?? {}) },
      localization: { ...current.localization, ...(dto.localization ?? {}) },
      payments: {
        ...current.payments,
        ...(dto.payments ?? {}),
        methods: { ...current.payments.methods, ...(dto.payments?.methods ?? {}) },
      },
      checkout: { ...current.checkout, ...(dto.checkout ?? {}) },
      notifications: { ...current.notifications, ...(dto.notifications ?? {}) },
      seo: { ...current.seo, ...(dto.seo ?? {}) },
      team,
      appearance: { ...current.appearance, ...(dto.appearance ?? {}) },
      inventory: { ...current.inventory, ...(dto.inventory ?? {}) },
      order: { ...current.order, ...(dto.order ?? {}) },
      email: { ...current.email, ...(dto.email ?? {}) },
      // Configurator: full-group replace when provided (the admin editor sends
      // the whole configurator object), else keep current / default.
      configurator:
        dto.configurator ?? current.configurator ?? DEFAULT_GLOBAL_CONFIGURATOR,
      updatedAt: new Date().toISOString(),
    };

    return ok(await repo.update(next));
  },
};
