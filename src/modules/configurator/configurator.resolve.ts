/**
 * resolveConfig — the single source of truth for "what configurator does THIS
 * product actually offer?".
 *
 * Applies the per-product override (inherit / custom / disabled) on top of the
 * store-wide global config. Both the PDP (to render) and the server (to
 * validate & price a selection) call this, so they can never drift apart.
 *
 * "Data is the switch": a group is shown (`show: true`) only when it is enabled
 * globally, not disabled on the product, AND has at least one option. Anything
 * else resolves to `show: false` with empty options — the UI renders nothing.
 */

import type {
  GlobalConfigurator,
  ProductConfigurator,
  ResolvedConfigurator,
  ResolvedPooja,
  ResolvedJaap,
  ResolvedWear,
  PoojaOption,
  MantraJaapOption,
  WearType,
} from "./configurator.types";
import { DEFAULT_GLOBAL_CONFIGURATOR } from "./configurator.defaults";

const EMPTY_POOJA: ResolvedPooja = { show: false, options: [] };
const EMPTY_JAAP: ResolvedJaap = { show: false, options: [] };
const EMPTY_WEAR: ResolvedWear = {
  show: false,
  choices: [],
  metals: [],
  designs: [],
  sizeSystems: [],
};

function resolvePooja(
  global: GlobalConfigurator["pooja"],
  override: ProductConfigurator["pooja"],
): ResolvedPooja {
  const mode = override?.mode ?? "inherit";
  if (mode === "disabled" || !global.enabled) return EMPTY_POOJA;
  const options: PoojaOption[] =
    mode === "custom" ? override?.options ?? [] : global.options;
  const clean = options.filter((o) => o && o.id && o.label);
  return clean.length > 0 ? { show: true, options: clean } : EMPTY_POOJA;
}

function resolveJaap(
  global: GlobalConfigurator["mantraJaap"],
  override: ProductConfigurator["mantraJaap"],
): ResolvedJaap {
  const mode = override?.mode ?? "inherit";
  if (mode === "disabled" || !global.enabled) return EMPTY_JAAP;
  const options: MantraJaapOption[] =
    mode === "custom" ? override?.options ?? [] : global.options;
  const clean = options.filter((o) => o && o.id && o.label);
  return clean.length > 0 ? { show: true, options: clean } : EMPTY_JAAP;
}

function resolveWear(
  global: GlobalConfigurator["wear"],
  override: ProductConfigurator["wear"],
): ResolvedWear {
  const mode = override?.mode ?? "inherit";
  if (mode === "disabled" || !global.enabled) return EMPTY_WEAR;

  const src =
    mode === "custom"
      ? {
          choices: override?.choices ?? [],
          metals: override?.metals ?? [],
          designs: override?.designs ?? [],
          sizeSystems: override?.sizeSystems ?? [],
        }
      : {
          choices: global.choices,
          metals: global.metals,
          designs: global.designs,
          sizeSystems: global.sizeSystems,
        };

  // "loose" is always implicitly available; a wear section with only "loose"
  // and nothing else to configure is pointless, so require a non-loose choice.
  const choices = (src.choices ?? []).filter(Boolean) as WearType[];
  const hasMountable = choices.some((c) => c === "ring" || c === "pendant");
  if (!hasMountable) return EMPTY_WEAR;

  // Ensure "loose" is offered so the customer can always decline mounting.
  const finalChoices: WearType[] = choices.includes("loose")
    ? choices
    : ["loose", ...choices];

  return {
    show: true,
    choices: finalChoices,
    metals: (src.metals ?? []).filter((m) => m && m.id && m.label),
    designs: (src.designs ?? []).filter((d) => d && d.id && d.label),
    sizeSystems: src.sizeSystems ?? [],
  };
}

/**
 * Resolve the effective configurator for a product.
 * @param productConfig  product.configurator (may be undefined for legacy data)
 * @param globalConfig   settings.data.configurator (falls back to defaults)
 */
export function resolveConfig(
  productConfig: ProductConfigurator | undefined | null,
  globalConfig: GlobalConfigurator | undefined | null,
): ResolvedConfigurator {
  const global = globalConfig ?? DEFAULT_GLOBAL_CONFIGURATOR;
  const pc = productConfig ?? {};

  const pooja = resolvePooja(global.pooja, pc.pooja);
  const mantraJaap = resolveJaap(global.mantraJaap, pc.mantraJaap);
  const wear = resolveWear(global.wear, pc.wear);

  return {
    pooja,
    mantraJaap,
    wear,
    hasAny: pooja.show || mantraJaap.show || wear.show,
  };
}
