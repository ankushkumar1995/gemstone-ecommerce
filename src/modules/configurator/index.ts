/**
 * Product Configurator module — pooja / mantra-jaap / choice-of-wear.
 * Single import surface for types, defaults, resolver and pricing.
 */

export * from "./configurator.types";
export { DEFAULT_GLOBAL_CONFIGURATOR } from "./configurator.defaults";
export { resolveConfig } from "./configurator.resolve";
export { priceConfig, type PriceConfigResult } from "./configurator.price";
