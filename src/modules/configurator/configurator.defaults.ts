/**
 * Configurator — sensible out-of-the-box global defaults.
 *
 * Used when the store has not configured its own values yet. The admin can
 * fully override all of this from Settings → Configurator. Keeping the defaults
 * here (not hardcoded in the resolver) means the "shipped" behaviour is one
 * obvious, editable place.
 */

import type { GlobalConfigurator } from "./configurator.types";

export const DEFAULT_GLOBAL_CONFIGURATOR: GlobalConfigurator = {
  pooja: {
    enabled: true,
    options: [
      {
        id: "shudh-basic",
        label: "SHUDH - Basic Energization",
        price: 0,
        extraDays: 0,
        default: true,
        description: "Standard mantra energization before dispatch. Included free.",
      },
      {
        id: "shudh-vedic",
        label: "SHUDH - Vedic Pooja with Video",
        price: 500,
        extraDays: 2,
        description: "A fuller Vedic pooja performed by our pandits, recorded on video.",
      },
    ],
  },
  mantraJaap: {
    enabled: true,
    options: [
      { id: "jaap-111", label: "111 Mantra Jaap", price: 500 },
      { id: "jaap-2100", label: "2100 Mantra Jaap", price: 2100 },
      { id: "jaap-5100", label: "5100 Mantra Jaap", price: 2999 },
      { id: "jaap-11000", label: "11000 Mantra Jaap", price: 3999 },
    ],
  },
  wear: {
    enabled: true,
    choices: ["loose", "ring", "pendant"],
    metals: [
      { id: "18k-gold", label: "18k Gold", chargeType: "flat", value: 0 },
      { id: "22k-gold", label: "22k Gold", chargeType: "flat", value: 0 },
      { id: "silver", label: "Silver", chargeType: "flat", value: 0 },
      { id: "panchdhatu", label: "Panchdhatu", chargeType: "flat", value: 0 },
    ],
    designs: [
      { id: "R1", label: "R1", makingChargePercent: 18 },
      { id: "R2", label: "R2", makingChargePercent: 18 },
      { id: "R3", label: "R3", makingChargePercent: 18 },
    ],
    sizeSystems: ["indian", "us", "dont_know"],
  },
};
