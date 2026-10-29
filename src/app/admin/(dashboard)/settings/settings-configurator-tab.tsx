"use client";

/**
 * Settings → Configurator tab. Manages the STORE-WIDE global defaults for the
 * product configurator: pooja/energization options, mantra-jaap options, and
 * the choice-of-wear (metals, designs, size systems). Each product then
 * inherits, customizes or disables these (handled in the product form).
 */

import { useState } from "react";
import { Plus, Trash2, Flame, Sparkles, Gem, Save } from "lucide-react";
import type { StoreSettings, UpdateSettingsDto } from "@/modules/settings";
import type {
  GlobalConfigurator,
  PoojaOption,
  MantraJaapOption,
  WearMetalOption,
  WearDesignOption,
  WearType,
  RingSizeSystem,
} from "@/modules/configurator";
import { DEFAULT_GLOBAL_CONFIGURATOR } from "@/modules/configurator";
import {
  Card,
  Field,
  AdminInput,
  AdminButton,
  AdminSelect,
  Toggle,
  ImagePickerField,
} from "../../_components";

let idSeq = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idSeq++}`;

export function ConfiguratorTab({
  settings,
  saving,
  onSave,
}: {
  settings: StoreSettings;
  saving: boolean;
  onSave: (section: UpdateSettingsDto) => void;
}) {
  const [cfg, setCfg] = useState<GlobalConfigurator>(
    settings.configurator ?? DEFAULT_GLOBAL_CONFIGURATOR,
  );

  const patch = (next: Partial<GlobalConfigurator>) => setCfg({ ...cfg, ...next });

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Pooja ───────────────────────────────────────────── */}
      <Card>
        <GroupHeader
          icon={Flame}
          title="Pooja & Energization"
          enabled={cfg.pooja.enabled}
          onToggle={(v) => patch({ pooja: { ...cfg.pooja, enabled: v } })}
        />
        {cfg.pooja.enabled && (
          <div className="mt-4 space-y-3">
            {cfg.pooja.options.map((o, i) => (
              <OptionEditor
                key={o.id}
                onRemove={() =>
                  patch({
                    pooja: {
                      ...cfg.pooja,
                      options: cfg.pooja.options.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                <Field label="Label">
                  <AdminInput
                    value={o.label}
                    onChange={(e) => updatePooja(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="Price (₹)" hint="0 = free">
                  <AdminInput
                    type="number"
                    value={String(o.price)}
                    onChange={(e) => updatePooja(i, { price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Extra days">
                  <AdminInput
                    type="number"
                    value={String(o.extraDays ?? 0)}
                    onChange={(e) => updatePooja(i, { extraDays: Number(e.target.value) })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}>
                  <input
                    type="radio"
                    checked={Boolean(o.default)}
                    onChange={() =>
                      patch({
                        pooja: {
                          ...cfg.pooja,
                          options: cfg.pooja.options.map((x, j) => ({ ...x, default: j === i })),
                        },
                      })
                    }
                  />
                  Default (pre-selected)
                </label>
              </OptionEditor>
            ))}
            <AddButton
              label="Add pooja option"
              onClick={() =>
                patch({
                  pooja: {
                    ...cfg.pooja,
                    options: [
                      ...cfg.pooja.options,
                      { id: genId("pooja"), label: "New option", price: 0 },
                    ],
                  },
                })
              }
            />
          </div>
        )}
      </Card>

      {/* ── Mantra Jaap ─────────────────────────────────────── */}
      <Card>
        <GroupHeader
          icon={Sparkles}
          title="Mantra Jaap"
          enabled={cfg.mantraJaap.enabled}
          onToggle={(v) => patch({ mantraJaap: { ...cfg.mantraJaap, enabled: v } })}
        />
        {cfg.mantraJaap.enabled && (
          <div className="mt-4 space-y-3">
            {cfg.mantraJaap.options.map((o, i) => (
              <OptionEditor
                key={o.id}
                onRemove={() =>
                  patch({
                    mantraJaap: {
                      ...cfg.mantraJaap,
                      options: cfg.mantraJaap.options.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                <Field label="Label">
                  <AdminInput
                    value={o.label}
                    onChange={(e) => updateJaap(i, { label: e.target.value })}
                  />
                </Field>
                <Field label="Price (₹)">
                  <AdminInput
                    type="number"
                    value={String(o.price)}
                    onChange={(e) => updateJaap(i, { price: Number(e.target.value) })}
                  />
                </Field>
              </OptionEditor>
            ))}
            <AddButton
              label="Add jaap option"
              onClick={() =>
                patch({
                  mantraJaap: {
                    ...cfg.mantraJaap,
                    options: [
                      ...cfg.mantraJaap.options,
                      { id: genId("jaap"), label: "New jaap", price: 0 },
                    ],
                  },
                })
              }
            />
          </div>
        )}
      </Card>

      {/* ── Choice of Wear ──────────────────────────────────── */}
      <Card>
        <GroupHeader
          icon={Gem}
          title="Choice of Wear (Ring / Pendant)"
          enabled={cfg.wear.enabled}
          onToggle={(v) => patch({ wear: { ...cfg.wear, enabled: v } })}
        />
        {cfg.wear.enabled && (
          <div className="mt-4 space-y-5">
            {/* choices */}
            <Field label="Offered choices">
              <div className="flex flex-wrap gap-2">
                {(["loose", "ring", "pendant"] as WearType[]).map((c) => {
                  const on = cfg.wear.choices.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        patch({
                          wear: {
                            ...cfg.wear,
                            choices: on
                              ? cfg.wear.choices.filter((x) => x !== c)
                              : [...cfg.wear.choices, c],
                          },
                        })
                      }
                      className="rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                      style={{
                        borderColor: on ? "var(--a-gold)" : "var(--a-border)",
                        background: on ? "var(--a-gold-soft)" : "transparent",
                        color: on ? "var(--a-gold)" : "var(--a-fg)",
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* metals */}
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>Metals</p>
              <div className="space-y-3">
                {cfg.wear.metals.map((m, i) => (
                  <OptionEditor
                    key={m.id}
                    onRemove={() =>
                      patch({ wear: { ...cfg.wear, metals: cfg.wear.metals.filter((_, j) => j !== i) } })
                    }
                  >
                    <Field label="Label">
                      <AdminInput value={m.label} onChange={(e) => updateMetal(i, { label: e.target.value })} />
                    </Field>
                    <Field label="Charge type">
                      <AdminSelect
                        value={m.chargeType}
                        onChange={(e) => updateMetal(i, { chargeType: e.target.value as "flat" | "percent" })}
                      >
                        <option value="flat">Flat (₹)</option>
                        <option value="percent">Percent of base (%)</option>
                      </AdminSelect>
                    </Field>
                    <Field label="Value">
                      <AdminInput
                        type="number"
                        value={String(m.value)}
                        onChange={(e) => updateMetal(i, { value: Number(e.target.value) })}
                      />
                    </Field>
                  </OptionEditor>
                ))}
                <AddButton
                  label="Add metal"
                  onClick={() =>
                    patch({
                      wear: {
                        ...cfg.wear,
                        metals: [
                          ...cfg.wear.metals,
                          { id: genId("metal"), label: "New metal", chargeType: "flat", value: 0 },
                        ],
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* designs */}
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>Designs</p>
              <div className="space-y-3">
                {cfg.wear.designs.map((d, i) => (
                  <OptionEditor
                    key={d.id}
                    onRemove={() =>
                      patch({ wear: { ...cfg.wear, designs: cfg.wear.designs.filter((_, j) => j !== i) } })
                    }
                  >
                    <Field label="Design image">
                      <ImagePickerField
                        value={d.image ?? ""}
                        onChange={(url) => updateDesign(i, { image: url })}
                        folder="ring-designs"
                        aspect="aspect-square"
                      />
                    </Field>
                    <Field label="Label">
                      <AdminInput value={d.label} onChange={(e) => updateDesign(i, { label: e.target.value })} />
                    </Field>
                    <Field label="Making charge (%)" hint="Applied to base + metal">
                      <AdminInput
                        type="number"
                        value={String(d.makingChargePercent)}
                        onChange={(e) => updateDesign(i, { makingChargePercent: Number(e.target.value) })}
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(d.advanceOnly)}
                        onChange={(e) => updateDesign(i, { advanceOnly: e.target.checked })}
                      />
                      Advance only
                    </label>
                  </OptionEditor>
                ))}
                <AddButton
                  label="Add design"
                  onClick={() =>
                    patch({
                      wear: {
                        ...cfg.wear,
                        designs: [
                          ...cfg.wear.designs,
                          { id: genId("design"), label: "New design", makingChargePercent: 18 },
                        ],
                      },
                    })
                  }
                />
              </div>
            </div>

            {/* size systems */}
            <Field label="Ring size systems offered">
              <div className="flex flex-wrap gap-2">
                {(["indian", "us", "dont_know"] as RingSizeSystem[]).map((s) => {
                  const on = cfg.wear.sizeSystems.includes(s);
                  const label = s === "dont_know" ? "I don't know" : s === "us" ? "US" : "Indian";
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        patch({
                          wear: {
                            ...cfg.wear,
                            sizeSystems: on
                              ? cfg.wear.sizeSystems.filter((x) => x !== s)
                              : [...cfg.wear.sizeSystems, s],
                          },
                        })
                      }
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        borderColor: on ? "var(--a-gold)" : "var(--a-border)",
                        background: on ? "var(--a-gold-soft)" : "transparent",
                        color: on ? "var(--a-gold)" : "var(--a-fg)",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <AdminButton onClick={() => onSave({ configurator: cfg })} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save configurator"}
        </AdminButton>
      </div>
    </div>
  );

  /* ── local updaters ─────────────────────────────────────── */
  function updatePooja(i: number, patchOpt: Partial<PoojaOption>) {
    patch({
      pooja: {
        ...cfg.pooja,
        options: cfg.pooja.options.map((o, j) => (j === i ? { ...o, ...patchOpt } : o)),
      },
    });
  }
  function updateJaap(i: number, patchOpt: Partial<MantraJaapOption>) {
    patch({
      mantraJaap: {
        ...cfg.mantraJaap,
        options: cfg.mantraJaap.options.map((o, j) => (j === i ? { ...o, ...patchOpt } : o)),
      },
    });
  }
  function updateMetal(i: number, patchOpt: Partial<WearMetalOption>) {
    patch({
      wear: {
        ...cfg.wear,
        metals: cfg.wear.metals.map((m, j) => (j === i ? { ...m, ...patchOpt } : m)),
      },
    });
  }
  function updateDesign(i: number, patchOpt: Partial<WearDesignOption>) {
    patch({
      wear: {
        ...cfg.wear,
        designs: cfg.wear.designs.map((d, j) => (j === i ? { ...d, ...patchOpt } : d)),
      },
    });
  }
}

/* ── small building blocks ──────────────────────────────────── */

function GroupHeader({
  icon: Icon,
  title,
  enabled,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
        >
          <Icon size={16} />
        </span>
        <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h2>
      </div>
      <Toggle checked={enabled} onChange={onToggle} label={enabled ? "Enabled" : "Disabled"} />
    </div>
  );
}

function OptionEditor({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div
      className="relative grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2"
      style={{ borderColor: "var(--a-border)" }}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.02]"
      style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
    >
      <Plus size={15} /> {label}
    </button>
  );
}
