"use client";

/**
 * CollectionsSelect — multi-select chips for the dynamic collections a
 * product belongs to.
 * RelatedProductsPicker — searchable multi-select of other products
 * ("frequently bought with").
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Search } from "lucide-react";
import type { Collection, Product } from "@/types";

/* ---------------- CollectionsSelect ---------------- */
export function CollectionsSelect({
  all,
  selected,
  onChange,
}: {
  all: Collection[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  if (all.length === 0)
    return (
      <p className="text-xs" style={{ color: "var(--a-faint)" }}>
        No collections yet. Create some in Collections.
      </p>
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderColor: on ? "var(--a-gold)" : "var(--a-border)",
              background: on ? "var(--a-gold-soft)" : "transparent",
              color: on ? "var(--a-gold)" : "var(--a-fg)",
            }}
          >
            {on && <Check size={12} />}
            {c.title}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- RelatedProductsPicker ---------------- */
export function RelatedProductsPicker({
  all,
  selected,
  onChange,
  currentId,
}: {
  all: Product[];
  selected: string[];
  onChange: (ids: string[]) => void;
  currentId?: string;
}) {
  const [query, setQuery] = useState("");

  const options = useMemo(
    () => all.filter((p) => p.id !== currentId),
    [all, currentId]
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return options
      .filter((p) => p.name.toLowerCase().includes(term) && !selected.includes(p.id))
      .slice(0, 6);
  }, [query, options, selected]);

  const chosen = options.filter((p) => selected.includes(p.id));

  return (
    <div>
      {chosen.length > 0 && (
        <div className="mb-2 space-y-1.5">
          <AnimatePresence>
            {chosen.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
                style={{ borderColor: "var(--a-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-7 w-7 rounded object-cover" />
                <span className="flex-1 truncate text-sm" style={{ color: "var(--a-fg)" }}>
                  {p.name}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== p.id))}
                  className="text-rose-600"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--a-muted)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products to link…"
          className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        />
        {matches.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg"
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange([...selected, p.id]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-7 w-7 rounded object-cover" />
                <span className="truncate text-sm" style={{ color: "var(--a-fg)" }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
