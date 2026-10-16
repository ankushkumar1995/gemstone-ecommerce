"use client";

/**
 * ProductVariantsManager — live editor for a product's `fullVariants` matrix.
 *
 * Unlike the rest of the product form (which batches everything into one
 * create/update call), each variant action here hits the dedicated per-variant
 * endpoints immediately so a single variant can be added / edited / removed
 * without re-sending the whole product:
 *
 *   POST   /api/v1/products/:id/variants         → add
 *   PATCH  /api/v1/products/:id/variants/:sku     → update (by SKU)
 *   DELETE /api/v1/products/:id/variants/:sku      → remove (by SKU)
 *
 * It is only usable for a product that already exists (you need an id to target
 * a variant). For a brand-new, unsaved product we show a "save first" hint.
 *
 * Each successful call returns the full updated Product; we lift that back up
 * via `onProductChange` so stock rollups (stockQty / stockStatus) stay in sync
 * with what the server computed.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Loader2, Package, Star, StarOff } from "lucide-react";
import type { Product } from "@/types";
import type { AddVariantDto, UpdateVariantDto } from "@/modules/products";
import { adminApi } from "@/lib/admin-api";
import { AdminButton, AdminInput, Field, useAdminToast } from "@/app/admin/_components";

type FullVariant = NonNullable<Product["fullVariants"]>[number];

/** A blank draft row for the "add variant" form. */
function emptyDraft(): {
  sku: string;
  price: string;
  mrp: string;
  stockQty: string;
  weightGram: string;
  barcode: string;
  optionValues: string;
} {
  return { sku: "", price: "", mrp: "", stockQty: "0", weightGram: "", barcode: "", optionValues: "" };
}

/** Render a variant's option-value map as "Size: 7, Metal: Gold". */
function optionsLabel(ov: Record<string, string> | undefined): string {
  if (!ov) return "";
  const pairs = Object.entries(ov).filter(([, v]) => v);
  return pairs.map(([k, v]) => `${k}: ${v}`).join(", ");
}

/** Parse "Size: 7, Metal: Gold" back into an option-value map. */
function parseOptions(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const [k, ...rest] = part.split(":");
    const key = k?.trim();
    const val = rest.join(":").trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export function ProductVariantsManager({
  product,
  onProductChange,
}: {
  product: Product;
  onProductChange: (next: Product) => void;
}) {
  const { toast } = useAdminToast();
  const variants = product.fullVariants ?? [];

  const [draft, setDraft] = useState(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [busySku, setBusySku] = useState<string | null>(null);

  /* ---- add ---- */
  const handleAdd = async () => {
    const payload: AddVariantDto = {
      sku: draft.sku.trim() || undefined,
      optionValues: parseOptions(draft.optionValues),
      price: draft.price ? Number(draft.price) : undefined,
      mrp: draft.mrp ? Number(draft.mrp) : undefined,
      stockQty: Number(draft.stockQty || 0),
      weightGram: draft.weightGram ? Number(draft.weightGram) : undefined,
      barcode: draft.barcode.trim() || undefined,
      active: true,
    };
    setAdding(true);
    const res = await adminApi.products.addVariant(product.id, payload);
    setAdding(false);
    if (res.ok) {
      onProductChange(res.data);
      setDraft(emptyDraft());
      toast("Variant added", "success");
    } else {
      toast(res.message, "error");
    }
  };

  /* ---- update one field of an existing variant ---- */
  const handleUpdate = async (sku: string, patch: UpdateVariantDto) => {
    setBusySku(sku);
    const res = await adminApi.products.updateVariant(product.id, sku, patch);
    setBusySku(null);
    if (res.ok) {
      onProductChange(res.data);
      toast("Variant updated", "success");
    } else {
      toast(res.message, "error");
    }
  };

  /* ---- remove ---- */
  const handleRemove = async (sku: string) => {
    setBusySku(sku);
    const res = await adminApi.products.removeVariant(product.id, sku);
    setBusySku(null);
    if (res.ok) {
      onProductChange(res.data);
      toast("Variant removed", "success");
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <div className="space-y-5">
      {/* existing variants */}
      {variants.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center"
          style={{ borderColor: "var(--a-border)" }}
        >
          <Package size={26} style={{ color: "var(--a-faint)" }} />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
            No variants yet
          </p>
          <p className="text-xs" style={{ color: "var(--a-faint)" }}>
            Add size / metal / carat variations below. Product stock will roll up from them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {variants.map((v, i) => (
              <VariantRow
                key={v.sku || `variant-${i}`}
                variant={v}
                busy={busySku === (v.sku ?? "")}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* add new variant */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
      >
        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
          Add a variant
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SKU" hint="Optional — unique per product">
            <AdminInput
              value={draft.sku}
              onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              placeholder="RUBY-5CT-GOLD"
            />
          </Field>
          <Field label="Options" hint="e.g. Size: 7, Metal: Gold">
            <AdminInput
              value={draft.optionValues}
              onChange={(e) => setDraft({ ...draft, optionValues: e.target.value })}
              placeholder="Size: 7, Metal: Gold"
            />
          </Field>
          <Field label="Stock qty">
            <AdminInput
              type="number"
              min={0}
              value={draft.stockQty}
              onChange={(e) => setDraft({ ...draft, stockQty: e.target.value })}
            />
          </Field>
          <Field label="Price (₹)" hint="Blank = use product price">
            <AdminInput
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="MRP (₹)">
            <AdminInput
              type="number"
              min={0}
              value={draft.mrp}
              onChange={(e) => setDraft({ ...draft, mrp: e.target.value })}
              placeholder="0"
            />
          </Field>
          <Field label="Weight (g)">
            <AdminInput
              type="number"
              min={0}
              step="0.01"
              value={draft.weightGram}
              onChange={(e) => setDraft({ ...draft, weightGram: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <AdminButton type="button" onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {adding ? "Adding…" : "Add variant"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- a single editable variant row ---------------- */
function VariantRow({
  variant,
  busy,
  onUpdate,
  onRemove,
}: {
  variant: FullVariant;
  busy: boolean;
  onUpdate: (sku: string, patch: UpdateVariantDto) => void;
  onRemove: (sku: string) => void;
}) {
  const sku = variant.sku ?? "";
  const [price, setPrice] = useState(variant.price !== undefined ? String(variant.price) : "");
  const [stockQty, setStockQty] = useState(String(variant.stockQty ?? 0));
  const [dirty, setDirty] = useState(false);

  // A variant with no SKU can't be targeted by the by-SKU endpoints.
  const targetable = Boolean(sku);

  const save = () => {
    if (!targetable) return;
    onUpdate(sku, {
      price: price === "" ? undefined : Number(price),
      stockQty: Number(stockQty || 0),
    });
    setDirty(false);
  };

  const toggleDefault = () => {
    if (!targetable) return;
    onUpdate(sku, { isDefault: !variant.isDefault });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
            {sku || "(no SKU)"}
            {variant.isDefault && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}
              >
                Default
              </span>
            )}
            {variant.active === false && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "var(--a-surface-2)", color: "var(--a-faint)" }}
              >
                Inactive
              </span>
            )}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
            {optionsLabel(variant.optionValues) || "No options"}
          </p>
        </div>

        <div className="w-24">
          <Field label="Price">
            <AdminInput
              type="number"
              min={0}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setDirty(true);
              }}
              placeholder="—"
            />
          </Field>
        </div>
        <div className="w-24">
          <Field label="Stock">
            <AdminInput
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => {
                setStockQty(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleDefault}
            disabled={busy || !targetable}
            title={variant.isDefault ? "Unset default" : "Set as default"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04] disabled:opacity-40"
            style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}
          >
            {variant.isDefault ? <Star size={15} fill="currentColor" /> : <StarOff size={15} />}
          </button>
          <AdminButton
            type="button"
            variant="outline"
            onClick={save}
            disabled={busy || !dirty || !targetable}
            className="!px-3 !py-2 text-xs"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </AdminButton>
          <button
            type="button"
            onClick={() => targetable && onRemove(sku)}
            disabled={busy || !targetable}
            title="Remove variant"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10 disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {!targetable && (
        <p className="mt-2 text-xs text-rose-600">
          This variant has no SKU, so it can&apos;t be edited individually. Give it a SKU via the full
          product save, then edit it here.
        </p>
      )}
    </motion.div>
  );
}
