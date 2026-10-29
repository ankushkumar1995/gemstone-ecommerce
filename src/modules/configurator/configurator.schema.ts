/**
 * Configurator — zod validation schemas. Shared by:
 *   • settings update (global config)
 *   • product create/update (per-product override)
 *
 * These guard the shape written to the flexible Mixed fields.
 */

import { z } from "zod";

export const poojaOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(0),
  extraDays: z.coerce.number().int().min(0).optional(),
  default: z.coerce.boolean().optional(),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const mantraJaapOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(0),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export const wearTypeSchema = z.enum(["loose", "ring", "pendant"]);
export const ringSizeSystemSchema = z.enum(["indian", "us", "dont_know"]);

export const wearMetalOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80),
  chargeType: z.enum(["flat", "percent"]),
  value: z.coerce.number().min(0),
});

export const wearDesignOptionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(80),
  image: z.string().trim().optional().or(z.literal("")),
  makingChargePercent: z.coerce.number().min(0).max(100),
  advanceOnly: z.coerce.boolean().optional(),
  appliesTo: z.array(wearTypeSchema).optional(),
});

/* ── Global config (settings) ──────────────────────────────────────────── */

export const globalConfiguratorSchema = z.object({
  pooja: z.object({
    enabled: z.coerce.boolean(),
    options: z.array(poojaOptionSchema),
  }),
  mantraJaap: z.object({
    enabled: z.coerce.boolean(),
    options: z.array(mantraJaapOptionSchema),
  }),
  wear: z.object({
    enabled: z.coerce.boolean(),
    choices: z.array(wearTypeSchema),
    metals: z.array(wearMetalOptionSchema),
    designs: z.array(wearDesignOptionSchema),
    sizeSystems: z.array(ringSizeSystemSchema),
  }),
});

/* ── Per-product override ──────────────────────────────────────────────── */

const groupModeSchema = z.enum(["inherit", "custom", "disabled"]);

export const productConfiguratorSchema = z.object({
  pooja: z
    .object({ mode: groupModeSchema, options: z.array(poojaOptionSchema).optional() })
    .optional(),
  mantraJaap: z
    .object({ mode: groupModeSchema, options: z.array(mantraJaapOptionSchema).optional() })
    .optional(),
  wear: z
    .object({
      mode: groupModeSchema,
      choices: z.array(wearTypeSchema).optional(),
      metals: z.array(wearMetalOptionSchema).optional(),
      designs: z.array(wearDesignOptionSchema).optional(),
      sizeSystems: z.array(ringSizeSystemSchema).optional(),
    })
    .optional(),
});

/* ── Customer selection (PDP → server) ─────────────────────────────────── */

export const configSelectionSchema = z.object({
  poojaId: z.string().trim().optional(),
  jaapId: z.string().trim().optional(),
  wear: z
    .object({
      type: wearTypeSchema,
      metalId: z.string().trim().optional(),
      designId: z.string().trim().optional(),
      sizeSystem: ringSizeSystemSchema.optional(),
      size: z.string().trim().max(40).optional(),
    })
    .optional(),
});
