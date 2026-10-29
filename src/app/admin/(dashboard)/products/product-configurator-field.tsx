"use client";

/**
 * Per-product configurator editor used in the product form. For each group
 * (pooja / mantra-jaap / choice-of-wear) the admin picks a MODE:
 *   • Inherit  — use the store-wide global config (shown read-only for clarity)
 *   • Customize — this product has its own options (edited here)
 *   • Disable  — hide the group for this product
 *
 * Emits a `ProductConfigurator` value the product form sends on save.
 */

import { Plus, Trash2 } from "lucide-react";
import type {
  ProductConfigurator,
  GroupMode,
  PoojaOption,
  MantraJaapOption,
  GlobalConfigurator,
  WearType,
  WearMetalOption,
  WearDesignOption,
  RingSizeSystem,
} from "@/modules/configurator";
import {
  Field,
  AdminInput,
  AdminButton,
  AdminSelect,
  ImagePickerField,
} from "@/app/admin/_components";

let seq = 0;
const genId = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

export function ProductConfiguratorField({
  value,
  onChange,
  global,
}: {
  value: ProductConfigurator;
  onChange: (next: ProductConfigurator) => void;
  /** Store-wide defaults, shown when a group is set to "inherit". */
  global?: GlobalConfigurator;
}) {
  const poojaMode = value.pooja?.mode ?? "inherit";
  const jaapMode = value.mantraJaap?.mode ?? "inherit";
  const wearMode = value.wear?.mode ?? "inherit";

  return (
    <div className="space-y-6">
      {/* ── Pooja ───────────────────────────────────────────── */}
      <GroupBlock
        title="Pooja & Energization"
        mode={poojaMode}
        onMode={(m) =>
          onChange({ ...value, pooja: { mode: m, options: value.pooja?.options } })
        }
        inheritSummary={summarizePooja(global?.pooja.options)}
      >
        {poojaMode === "custom" && (
          <OptionList
            rows={value.pooja?.options ?? []}
            onChange={(rows) => onChange({ ...value, pooja: { mode: "custom", options: rows } })}
            makeNew={() => ({ id: genId("pooja"), label: "New option", price: 0 })}
            fields={(row, update) => (
              <>
                <Field label="Label">
                  <AdminInput value={row.label} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Price (₹)" hint="0 = free">
                  <AdminInput
                    type="number"
                    value={String(row.price)}
                    onChange={(e) => update({ price: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
          />
        )}
      </GroupBlock>

      {/* ── Mantra Jaap ─────────────────────────────────────── */}
      <GroupBlock
        title="Mantra Jaap"
        mode={jaapMode}
        onMode={(m) =>
          onChange({ ...value, mantraJaap: { mode: m, options: value.mantraJaap?.options } })
        }
        inheritSummary={summarizeJaap(global?.mantraJaap.options)}
      >
        {jaapMode === "custom" && (
          <OptionList
            rows={value.mantraJaap?.options ?? []}
            onChange={(rows) => onChange({ ...value, mantraJaap: { mode: "custom", options: rows } })}
            makeNew={() => ({ id: genId("jaap"), label: "New jaap", price: 0 })}
            fields={(row, update) => (
              <>
                <Field label="Label">
                  <AdminInput value={row.label} onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field label="Price (₹)">
                  <AdminInput
                    type="number"
                    value={String(row.price)}
                    onChange={(e) => update({ price: Number(e.target.value) })}
                  />
                </Field>
              </>
            )}
          />
        )}
      </GroupBlock>

      {/* ── Choice of Wear ──────────────────────────────────── */}
      <GroupBlock
        title="Choice of Wear (Ring / Pendant)"
        mode={wearMode}
        onMode={(m) => onChange({ ...value, wear: { ...(value.wear ?? {}), mode: m } })}
        inheritSummary={
          global?.wear.enabled
            ? `Inherits: ${global.wear.choices.join(" / ")} · ${global.wear.metals.length} metals · ${global.wear.designs.length} designs`
            : "Global wear is disabled"
        }
      >
        {wearMode === "custom" && (
          <WearCustomEditor
            value={{
              choices: value.wear?.choices ?? ["loose", "ring"],
              metals: value.wear?.metals ?? [],
              designs: value.wear?.designs ?? [],
              sizeSystems: value.wear?.sizeSystems ?? ["indian", "us", "dont_know"],
            }}
            onChange={(w) => onChange({ ...value, wear: { mode: "custom", ...w } })}
          />
        )}
      </GroupBlock>
    </div>
  );
}

/* ── building blocks ────────────────────────────────────────── */

function GroupBlock({
  title,
  mode,
  onMode,
  inheritSummary,
  children,
}: {
  title: string;
  mode: GroupMode;
  onMode: (m: GroupMode) => void;
  inheritSummary?: string;
  children?: React.ReactNode;
}) {
  const modes: { v: GroupMode; label: string }[] = [
    { v: "inherit", label: "Inherit global" },
    { v: "custom", label: "Customize" },
    { v: "disabled", label: "Disable" },
  ];
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--a-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h3>
        <div className="flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--a-border)" }}>
          {modes.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => onMode(m.v)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                mode === m.v
                  ? { background: "var(--a-gold)", color: "#000" }
                  : { color: "var(--a-muted)" }
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {mode === "inherit" && inheritSummary && (
        <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>{inheritSummary}</p>
      )}
      {mode === "disabled" && (
        <p className="mt-2 text-xs" style={{ color: "var(--a-muted)" }}>
          Hidden on this product&apos;s page.
        </p>
      )}
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

/** Generic add/edit/remove list for a group's options. */
function OptionList<T extends { id: string }>({
  rows,
  onChange,
  makeNew,
  fields,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  makeNew: () => T;
  fields: (row: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <>
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="relative grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2"
          style={{ borderColor: "var(--a-border)" }}
        >
          {fields(row, (patch) =>
            onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))),
          )}
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            aria-label="Remove"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <AdminButton variant="outline" onClick={() => onChange([...rows, makeNew()])}>
        <Plus size={15} /> Add option
      </AdminButton>
    </>
  );
}

interface WearCustomValue {
  choices: WearType[];
  metals: WearMetalOption[];
  designs: WearDesignOption[];
  sizeSystems: RingSizeSystem[];
}

function WearCustomEditor({
  value,
  onChange,
}: {
  value: WearCustomValue;
  onChange: (v: WearCustomValue) => void;
}) {
  const toggleChoice = (c: WearType) =>
    onChange({
      ...value,
      choices: value.choices.includes(c)
        ? value.choices.filter((x) => x !== c)
        : [...value.choices, c],
    });
  const toggleSize = (s: RingSizeSystem) =>
    onChange({
      ...value,
      sizeSystems: value.sizeSystems.includes(s)
        ? value.sizeSystems.filter((x) => x !== s)
        : [...value.sizeSystems, s],
    });

  return (
    <div className="space-y-4">
      {/* choices */}
      <Field label="Offered choices">
        <div className="flex flex-wrap gap-2">
          {(["loose", "ring", "pendant"] as WearType[]).map((c) => {
            const on = value.choices.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleChoice(c)}
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
        <OptionList<WearMetalOption>
          rows={value.metals}
          onChange={(metals) => onChange({ ...value, metals })}
          makeNew={() => ({ id: genId("metal"), label: "New metal", chargeType: "flat", value: 0 })}
          fields={(row, update) => (
            <>
              <Field label="Label">
                <AdminInput value={row.label} onChange={(e) => update({ label: e.target.value })} />
              </Field>
              <Field label="Charge type">
                <AdminSelect
                  value={row.chargeType}
                  onChange={(e) => update({ chargeType: e.target.value as "flat" | "percent" })}
                >
                  <option value="flat">Flat (₹)</option>
                  <option value="percent">Percent of base (%)</option>
                </AdminSelect>
              </Field>
              <Field label="Value">
                <AdminInput
                  type="number"
                  value={String(row.value)}
                  onChange={(e) => update({ value: Number(e.target.value) })}
                />
              </Field>
            </>
          )}
        />
      </div>

      {/* designs */}
      <div>
        <p className="mb-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>Designs</p>
        <OptionList<WearDesignOption>
          rows={value.designs}
          onChange={(designs) => onChange({ ...value, designs })}
          makeNew={() => ({ id: genId("design"), label: "New design", makingChargePercent: 18 })}
          fields={(row, update) => (
            <>
              <Field label="Design image">
                <ImagePickerField
                  value={row.image ?? ""}
                  onChange={(url) => update({ image: url })}
                  folder="ring-designs"
                  aspect="aspect-square"
                />
              </Field>
              <Field label="Label">
                <AdminInput value={row.label} onChange={(e) => update({ label: e.target.value })} />
              </Field>
              <Field label="Making charge (%)">
                <AdminInput
                  type="number"
                  value={String(row.makingChargePercent)}
                  onChange={(e) => update({ makingChargePercent: Number(e.target.value) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--a-muted)" }}>
                <input
                  type="checkbox"
                  checked={Boolean(row.advanceOnly)}
                  onChange={(e) => update({ advanceOnly: e.target.checked })}
                />
                Advance only
              </label>
            </>
          )}
        />
      </div>

      {/* size systems */}
      <Field label="Ring size systems">
        <div className="flex flex-wrap gap-2">
          {(["indian", "us", "dont_know"] as RingSizeSystem[]).map((s) => {
            const on = value.sizeSystems.includes(s);
            const label = s === "dont_know" ? "I don't know" : s === "us" ? "US" : "Indian";
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
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
  );
}

function summarizePooja(options?: PoojaOption[]): string {
  if (!options || options.length === 0) return "No global pooja options set";
  return `Inherits ${options.length} option${options.length > 1 ? "s" : ""}: ${options.map((o) => o.label).join(", ")}`;
}
function summarizeJaap(options?: MantraJaapOption[]): string {
  if (!options || options.length === 0) return "No global jaap options set";
  return `Inherits ${options.length} option${options.length > 1 ? "s" : ""}`;
}
