/**
 * priceConfig — turn a customer's selection (just IDs) into a fully-priced,
 * validated config. SERVER-AUTHORITATIVE: prices come only from the resolved
 * definitions, never from the client. Invalid / unknown IDs are rejected.
 *
 * The same function also powers the PDP's live preview total, so the price the
 * customer sees is computed by the exact logic the server will re-run on
 * add-to-cart / checkout.
 *
 * Making-charge formula (locked): makingCharge = makingChargePercent% of
 * (basePrice + metalCharge). metalCharge is flat, or a % of basePrice.
 */

import type {
  ResolvedConfigurator,
  ConfigSelection,
  PricedConfig,
  WearType,
} from "./configurator.types";

export interface PriceConfigResult {
  ok: boolean;
  /** Present when ok. */
  priced?: PricedConfig;
  /** Final per-unit price = base + addOnTotal. Present when ok. */
  unitPrice?: number;
  /** Present when !ok — a user-facing reason. */
  error?: string;
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * @param basePrice   the product's base price (loose stone price)
 * @param resolved    resolveConfig(product, global) output
 * @param selection   the IDs the customer picked (from the PDP)
 */
export function priceConfig(
  basePrice: number,
  resolved: ResolvedConfigurator,
  selection: ConfigSelection | undefined | null,
): PriceConfigResult {
  const sel = selection ?? {};
  const priced: PricedConfig = { addOnTotal: 0 };
  let addOn = 0;

  /* ── Pooja ───────────────────────────────────────────────── */
  if (resolved.pooja.show) {
    // If a pooja group is shown, a choice is expected; fall back to the
    // default (free) option when the client sent nothing.
    const chosenId =
      sel.poojaId ??
      resolved.pooja.options.find((o) => o.default)?.id ??
      resolved.pooja.options[0]?.id;
    const opt = resolved.pooja.options.find((o) => o.id === chosenId);
    if (sel.poojaId && !opt) {
      return { ok: false, error: "Selected pooja option is no longer available." };
    }
    if (opt) {
      priced.pooja = {
        id: opt.id,
        label: opt.label,
        price: opt.price,
        extraDays: opt.extraDays,
      };
      addOn += opt.price;
    }
  } else if (sel.poojaId) {
    return { ok: false, error: "Pooja options are not available for this product." };
  }

  /* ── Mantra Jaap (optional) ──────────────────────────────── */
  if (sel.jaapId) {
    if (!resolved.mantraJaap.show) {
      return { ok: false, error: "Mantra jaap is not available for this product." };
    }
    const opt = resolved.mantraJaap.options.find((o) => o.id === sel.jaapId);
    if (!opt) {
      return { ok: false, error: "Selected mantra jaap is no longer available." };
    }
    priced.jaap = { id: opt.id, label: opt.label, price: opt.price };
    addOn += opt.price;
  }

  /* ── Choice of Wear ──────────────────────────────────────── */
  const wearType: WearType = sel.wear?.type ?? "loose";
  if (wearType !== "loose") {
    if (!resolved.wear.show) {
      return { ok: false, error: "This product cannot be mounted into jewellery." };
    }
    if (!resolved.wear.choices.includes(wearType)) {
      return { ok: false, error: `"${wearType}" is not available for this product.` };
    }

    // Metal
    const metal = sel.wear?.metalId
      ? resolved.wear.metals.find((m) => m.id === sel.wear?.metalId)
      : undefined;
    if (!metal) {
      return { ok: false, error: "Please select a metal for your jewellery." };
    }
    const metalCharge =
      metal.chargeType === "percent"
        ? round((basePrice * metal.value) / 100)
        : round(metal.value);

    // Design
    const design = sel.wear?.designId
      ? resolved.wear.designs.find((d) => d.id === sel.wear?.designId)
      : undefined;
    if (!design) {
      return { ok: false, error: "Please select a design for your jewellery." };
    }
    const makingCharge = round(
      ((basePrice + metalCharge) * design.makingChargePercent) / 100,
    );

    // Size — required unless the customer explicitly chose "I don't know".
    const sizeSystem = sel.wear?.sizeSystem;
    const size = sel.wear?.size;
    if (sizeSystem !== "dont_know" && !size) {
      return { ok: false, error: "Please select a ring/pendant size." };
    }
    if (sizeSystem && !resolved.wear.sizeSystems.includes(sizeSystem)) {
      return { ok: false, error: "Selected size system is not available." };
    }

    priced.wear = {
      type: wearType,
      metal: { id: metal.id, label: metal.label },
      design: { id: design.id, label: design.label, advanceOnly: design.advanceOnly },
      sizeSystem,
      size,
      metalCharge,
      makingCharge,
    };
    addOn += metalCharge + makingCharge;
  } else {
    priced.wear = { type: "loose", metalCharge: 0, makingCharge: 0 };
  }

  priced.addOnTotal = addOn;
  return { ok: true, priced, unitPrice: round(basePrice + addOn) };
}
