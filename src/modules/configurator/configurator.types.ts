/**
 * Product Configurator — shared types.
 * ─────────────────────────────────────────────────────────────────────
 * The storefront product page can offer, per product:
 *   • Pooja / Energization   (single-select, one is free & default)
 *   • Mantra Jaap            (single-select, optional)
 *   • Choice of Wear         (Loose / Ring / Pendant + metal + design + size)
 *
 * Design model (decided with the user): a store-wide GLOBAL default config
 * lives in settings; each product then INHERITS, CUSTOMIZES or DISABLES each
 * group. A single `resolveConfig()` turns (product + global) into the EFFECTIVE
 * config, and both the PDP (render) and the server (price validation) call it,
 * so they can never disagree. "Data is the switch": an empty/disabled group is
 * simply not shown.
 *
 * Pricing is server-authoritative — the client only ever sends selected option
 * IDs, never a price. The server recomputes totals from these definitions.
 */

/* ── Option primitives ─────────────────────────────────────────────────── */

export interface PoojaOption {
  id: string;
  label: string;
  /** Add-on price in store currency. 0 = free (typically the default). */
  price: number;
  /** Extra processing/dispatch days this choice adds (shown to the customer). */
  extraDays?: number;
  /** Marks the pre-selected free option. Exactly one should be default. */
  default?: boolean;
  description?: string;
}

export interface MantraJaapOption {
  id: string;
  label: string;
  price: number;
  description?: string;
}

export type WearType = "loose" | "ring" | "pendant";

/** How a metal adds to the price: a flat amount or a % of the base stone price. */
export type ChargeType = "flat" | "percent";

export interface WearMetalOption {
  id: string;
  label: string; // e.g. "18k Gold"
  chargeType: ChargeType;
  /** Flat amount (chargeType="flat") or percentage (chargeType="percent"). */
  value: number;
}

export interface WearDesignOption {
  id: string;
  label: string; // e.g. "R1"
  image?: string;
  /** Making charge as a % applied to (base stone + metal charge). */
  makingChargePercent: number;
  /** Design only available on advance order — allowed in cart but flagged. */
  advanceOnly?: boolean;
  /** Which wear types this design applies to (default: all offered). */
  appliesTo?: WearType[];
}

export type RingSizeSystem = "indian" | "us" | "dont_know";

export interface WearConfig {
  /** Which wear choices are offered. Must include at least "loose". */
  choices: WearType[];
  metals: WearMetalOption[];
  designs: WearDesignOption[];
  sizeSystems: RingSizeSystem[];
}

/* ── Global config (settings.data.configurator) ─────────────────────────── */

export interface GlobalPoojaConfig {
  enabled: boolean;
  options: PoojaOption[];
}
export interface GlobalJaapConfig {
  enabled: boolean;
  options: MantraJaapOption[];
}
export interface GlobalWearConfig extends WearConfig {
  enabled: boolean;
}

export interface GlobalConfigurator {
  pooja: GlobalPoojaConfig;
  mantraJaap: GlobalJaapConfig;
  wear: GlobalWearConfig;
}

/* ── Per-product override (product.configurator) ────────────────────────── */

/** How a product relates to the global config for a given group. */
export type GroupMode = "inherit" | "custom" | "disabled";

export interface ProductPoojaOverride {
  mode: GroupMode;
  /** Used only when mode="custom". */
  options?: PoojaOption[];
}
export interface ProductJaapOverride {
  mode: GroupMode;
  options?: MantraJaapOption[];
}
export interface ProductWearOverride {
  mode: GroupMode;
  /** Used only when mode="custom" (full replacement of the wear config). */
  choices?: WearType[];
  metals?: WearMetalOption[];
  designs?: WearDesignOption[];
  sizeSystems?: RingSizeSystem[];
}

export interface ProductConfigurator {
  pooja?: ProductPoojaOverride;
  mantraJaap?: ProductJaapOverride;
  wear?: ProductWearOverride;
}

/* ── Resolved (effective) config — what the PDP & server actually use ───── */

export interface ResolvedPooja {
  /** True only when there is at least one option to show. */
  show: boolean;
  options: PoojaOption[];
}
export interface ResolvedJaap {
  show: boolean;
  options: MantraJaapOption[];
}
export interface ResolvedWear {
  show: boolean;
  choices: WearType[];
  metals: WearMetalOption[];
  designs: WearDesignOption[];
  sizeSystems: RingSizeSystem[];
}

export interface ResolvedConfigurator {
  pooja: ResolvedPooja;
  mantraJaap: ResolvedJaap;
  wear: ResolvedWear;
  /** Convenience: is ANY configurator group visible for this product? */
  hasAny: boolean;
}

/* ── Customer selection (sent from PDP → cart/server) ───────────────────── */

export interface SelectedWear {
  type: WearType;
  metalId?: string;
  designId?: string;
  sizeSystem?: RingSizeSystem;
  size?: string;
}

/** Only IDs travel to the server; prices are recomputed there. */
export interface ConfigSelection {
  poojaId?: string;
  jaapId?: string;
  wear?: SelectedWear;
}

/** Fully-priced, resolved selection — stored on cart lines & order items. */
export interface PricedConfig {
  pooja?: { id: string; label: string; price: number; extraDays?: number };
  jaap?: { id: string; label: string; price: number };
  wear?: {
    type: WearType;
    metal?: { id: string; label: string };
    design?: { id: string; label: string; advanceOnly?: boolean };
    sizeSystem?: RingSizeSystem;
    size?: string;
    metalCharge: number;
    makingCharge: number;
  };
  /** Sum of all add-on charges on top of the base product price. */
  addOnTotal: number;
}
