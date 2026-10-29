"use client";

/**
 * ProductConfigurator — the storefront pooja / mantra-jaap / choice-of-wear
 * picker. Phase B renders the Pooja and Mantra-Jaap groups; the Choice-of-Wear
 * group arrives in Phase C (its data is already carried in `resolved`).
 *
 * Fully controlled: the parent (ProductDetail) owns the `selection` state and
 * the running total, so the price shown next to "Add to Cart" stays in sync.
 * Only visible groups render ("data is the switch").
 */

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Flame, CircleDot, Gem, Circle } from "lucide-react";
import type {
  ResolvedConfigurator,
  ConfigSelection,
  WearType,
  RingSizeSystem,
  SelectedWear,
} from "@/modules/configurator";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/* Common ring sizes per system (customer picks one). */
const RING_SIZES: Record<RingSizeSystem, string[]> = {
  indian: Array.from({ length: 22 }, (_, i) => String(i + 6)), // 6–27
  us: ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
  dont_know: [],
};

const SIZE_SYSTEM_LABEL: Record<RingSizeSystem, string> = {
  indian: "Indian",
  us: "US",
  dont_know: "I don't know",
};

const WEAR_LABEL: Record<WearType, string> = {
  loose: "Loose Gemstone",
  ring: "Ring",
  pendant: "Pendant",
};

export function ProductConfigurator({
  resolved,
  selection,
  onChange,
}: {
  resolved: ResolvedConfigurator;
  selection: ConfigSelection;
  onChange: (next: ConfigSelection) => void;
}) {
  const { format } = useCurrency();

  if (!resolved.pooja.show && !resolved.mantraJaap.show && !resolved.wear.show)
    return null;

  const setPooja = (id: string) => onChange({ ...selection, poojaId: id });
  const toggleJaap = (id: string) =>
    onChange({ ...selection, jaapId: selection.jaapId === id ? undefined : id });

  const wear = resolved.wear;
  const sel: SelectedWear = selection.wear ?? { type: "loose" };
  const setWear = (patch: Partial<SelectedWear>) =>
    onChange({ ...selection, wear: { ...sel, ...patch } });
  const setWearType = (type: WearType) => {
    if (type === "loose") {
      // Clear mounting choices when going back to a loose stone.
      onChange({ ...selection, wear: { type: "loose" } });
    } else {
      onChange({ ...selection, wear: { ...sel, type } });
    }
  };
  const activeSizes = sel.sizeSystem ? RING_SIZES[sel.sizeSystem] : [];

  return (
    <div className="mt-8 space-y-5">
      {/* ── Choice of Wear ───────────────────────────────────── */}
      {wear.show && (
        <section>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Gem size={13} className="text-gold-600" />
            Select the choice of wear
          </h3>

          {/* loose / ring / pendant cards */}
          <div className="grid grid-cols-3 gap-2">
            {wear.choices.map((c) => {
              const active = sel.type === c;
              return (
                <motion.button
                  key={c}
                  type="button"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 350, damping: 22 }}
                  onClick={() => setWearType(c)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-center transition-colors",
                    active
                      ? "border-gold-400/70 bg-gold-400/8 shadow-[0_8px_24px_-14px_rgba(201,148,42,0.6)]"
                      : "border-foreground/12 bg-nebula hover:border-gold-400/40 hover:bg-gold-400/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      active ? "bg-gold-400/20 text-gold-600" : "bg-foreground/5 text-muted",
                    )}
                  >
                    {c === "loose" ? <Circle size={14} /> : <Gem size={14} />}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {WEAR_LABEL[c]}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* ring/pendant → metal + design + size */}
          <AnimatePresence initial={false}>
            {sel.type !== "loose" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-5 rounded-2xl border border-foreground/10 bg-nebula/50 p-4">
                  {/* metal */}
                  {wear.metals.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Metal</p>
                      <div className="flex flex-wrap gap-2">
                        {wear.metals.map((m) => (
                          <motion.button
                            key={m.id}
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.96 }}
                            transition={{ type: "spring", stiffness: 400, damping: 24 }}
                            onClick={() => setWear({ metalId: m.id })}
                            className={cn(
                              "rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                              sel.metalId === m.id
                                ? "border-gold-400/70 bg-gold-400/10 text-gold-700"
                                : "border-foreground/15 bg-background text-foreground hover:border-gold-400/40",
                            )}
                          >
                            {m.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* design */}
                  {wear.designs.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Design</p>
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                        {wear.designs.map((d) => {
                          const active = sel.designId === d.id;
                          return (
                            <motion.button
                              key={d.id}
                              type="button"
                              whileHover={{ y: -3 }}
                              whileTap={{ scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 350, damping: 22 }}
                              onClick={() => setWear({ designId: d.id })}
                              className={cn(
                                "group relative overflow-hidden rounded-xl border transition-colors",
                                active
                                  ? "border-gold-400/70 shadow-[0_8px_24px_-14px_rgba(201,148,42,0.6)]"
                                  : "border-foreground/12 hover:border-gold-400/40",
                              )}
                            >
                              <div className="relative aspect-square w-full bg-foreground/5">
                                {d.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={d.image}
                                    alt={d.label}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-muted">
                                    <Gem size={22} />
                                  </span>
                                )}
                                {active && (
                                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-white">
                                    <Check size={12} />
                                  </span>
                                )}
                              </div>
                              <div className="p-1.5">
                                <p className="truncate text-[11px] font-medium text-foreground">{d.label}</p>
                                <p className="text-[10px] text-muted">
                                  +{d.makingChargePercent}% making
                                  {d.advanceOnly ? " · advance" : ""}
                                </p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* size */}
                  {wear.sizeSystems.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Size</p>
                      <div className="mb-2 flex flex-wrap gap-2">
                        {wear.sizeSystems.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setWear({ sizeSystem: s, size: undefined })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              sel.sizeSystem === s
                                ? "border-gold-400/70 bg-gold-400/10 text-gold-700"
                                : "border-foreground/15 text-foreground hover:border-foreground/30",
                            )}
                          >
                            {SIZE_SYSTEM_LABEL[s]}
                          </button>
                        ))}
                      </div>
                      {sel.sizeSystem && sel.sizeSystem !== "dont_know" && (
                        <div className="flex flex-wrap gap-1.5">
                          {activeSizes.map((sz) => (
                            <motion.button
                              key={sz}
                              type="button"
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.9 }}
                              transition={{ type: "spring", stiffness: 450, damping: 24 }}
                              onClick={() => setWear({ size: sz })}
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-medium transition-colors",
                                sel.size === sz
                                  ? "border-gold-400/70 bg-gold-400/10 text-gold-700"
                                  : "border-foreground/15 text-foreground hover:border-gold-400/40",
                              )}
                            >
                              {sz}
                            </motion.button>
                          ))}
                        </div>
                      )}
                      {sel.sizeSystem === "dont_know" && (
                        <p className="text-xs text-muted">
                          No problem — our team will contact you to confirm the size.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ── Pooja / Energization ─────────────────────────────── */}
      {resolved.pooja.show && (
        <section>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Flame size={13} className="text-gold-600" />
            Pooja &amp; Energization
          </h3>
          <div className="space-y-2">
            {resolved.pooja.options.map((o) => {
              const active = (selection.poojaId ?? defaultPoojaId(resolved)) === o.id;
              return (
                <OptionRow
                  key={o.id}
                  active={active}
                  single
                  onClick={() => setPooja(o.id)}
                  title={o.label}
                  subtitle={
                    o.extraDays
                      ? `Adds ~${o.extraDays} day${o.extraDays > 1 ? "s" : ""}`
                      : o.description
                  }
                  price={o.price === 0 ? "Free" : `+${format(o.price)}`}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Mantra Jaap (optional) ───────────────────────────── */}
      {resolved.mantraJaap.show && (
        <section>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <Sparkles size={13} className="text-gold-600" />
            Add Mantra Jaap
            <span className="font-normal normal-case text-muted/70">(optional)</span>
          </h3>
          <div className="space-y-2">
            {resolved.mantraJaap.options.map((o) => {
              const active = selection.jaapId === o.id;
              return (
                <OptionRow
                  key={o.id}
                  active={active}
                  onClick={() => toggleJaap(o.id)}
                  title={o.label}
                  subtitle={o.description}
                  price={`+${format(o.price)}`}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** The pre-selected (free/default) pooja id, so the UI shows a choice up front. */
function defaultPoojaId(resolved: ResolvedConfigurator): string | undefined {
  return (
    resolved.pooja.options.find((o) => o.default)?.id ??
    resolved.pooja.options[0]?.id
  );
}

function OptionRow({
  active,
  single,
  onClick,
  title,
  subtitle,
  price,
}: {
  active: boolean;
  single?: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  price: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
        active
          ? "border-gold-400/60 bg-gold-400/8 shadow-[0_6px_20px_-12px_rgba(201,148,42,0.5)]"
          : "border-foreground/12 bg-nebula hover:border-gold-400/40 hover:bg-gold-400/[0.03]",
      )}
    >
      {/* selector dot / check */}
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          active ? "border-gold-500 bg-gold-500 text-white" : "border-foreground/30 text-transparent",
        )}
      >
        <AnimatePresence>
          {active ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              {single ? <CircleDot size={10} /> : <Check size={10} />}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight text-foreground">{title}</p>
        {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}
      </div>

      <span
        className={cn(
          "shrink-0 text-[13px] font-semibold",
          price === "Free" ? "text-emerald-600" : "text-gold-600",
        )}
      >
        {price}
      </span>
    </motion.button>
  );
}
