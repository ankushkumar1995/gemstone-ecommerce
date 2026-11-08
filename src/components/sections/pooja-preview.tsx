"use client";

/**
 * Homepage "Online Pooja" section. Renders nothing when the admin has no
 * bookable pooja. Category chips filter the cards; a compact 3-step strip
 * explains how online pooja works.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame, ScrollText, Video, Package, LayoutGrid } from "lucide-react";
import type { PublicPoojaCategory, RitualType } from "@/modules/poojas/pooja.types";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { PoojaCard, poojaIcon, type CardPooja } from "@/components/pooja/pooja-ui";
import { cn } from "@/lib/utils";

/** Multiple of 3 (and 2) so the rows are always full. */
const LIMIT = 6;
/** Section copy per type. The pooja copy is unchanged from before havan existed. */
const COPY = {
  pooja: {
    id: "pooja-title", eyebrow: "Online Pooja", title: "Sacred Poojas, ", accent: "Performed in Your Name",
    text: "Book Vedic poojas at holy temples and with our pandits. Your sankalp, the full ritual, and the video and prasad delivered to you.",
    many: "poojas", all: "View All Poojas", base: "/pooja",
    steps: [
      { icon: ScrollText, title: "Choose & share sankalp", text: "Pick a pooja, date and the names to include." },
      { icon: Video, title: "Pooja in your name", text: "Learned pandits perform it with full vidhi." },
      { icon: Package, title: "Video & prasad", text: "Get the pooja video and prasad at your home." },
    ],
  },
  havan: {
    id: "havan-title", eyebrow: "Havan & Yagya", title: "Sacred Havan & Yagya, ", accent: "Offered in Your Name",
    text: "Vedic havan and anushthan with mantra jaap and ahutis by learned acharyas. Ekal or samuhik, with daily updates and havan bhasma at home.",
    many: "havans", all: "View All Havans", base: "/havan",
    steps: [
      { icon: ScrollText, title: "Pick havan & sankalp", text: "Choose the havan, tier, date and the names." },
      { icon: Flame, title: "Agni ritual with jaap", text: "Acharyas offer ahutis with mantra jaap." },
      { icon: Package, title: "Updates & bhasma", text: "Daily updates, the video and bhasma at home." },
    ],
  },
} as const;

export function PoojaPreview({ poojas, categories, type = "pooja" }: { poojas: CardPooja[]; categories: PublicPoojaCategory[]; type?: RitualType }) {
  const C = COPY[type];
  const STEPS = C.steps;
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const catByKey = useMemo(() => new Map(categories.map((c) => [c.key, c])), [categories]);
  const shown = useMemo(() => (active ? poojas.filter((p) => p.category === active) : poojas).slice(0, LIMIT), [poojas, active]);

  if (poojas.length === 0) return null;
  const activeCat = active ? catByKey.get(active) : undefined;

  return (
    <section aria-labelledby={C.id} className="relative overflow-hidden py-9 md:py-11">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-6 h-80 w-80 rounded-full bg-gold-400/12 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-rose-400/10 blur-3xl" />

      <Container className="relative">
        <SectionHeader
          eyebrow={C.eyebrow}
          title={<span id={C.id}>{C.title}<span className="text-gradient-gold">{C.accent}</span></span>}
          description={C.text}
        />

        {categories.length > 1 && (
          <div role="toolbar" aria-label={`Filter ${C.many} by category`} className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            <Chip active={!active} onClick={() => setActive(null)} icon={LayoutGrid} label="All" count={poojas.length} />
            {categories.map((c) => (
              <Chip key={c.key} active={active === c.key} onClick={() => setActive(c.key)} icon={poojaIcon(c.icon)} label={c.name} count={c.count} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.ul
            key={active ?? "all"}
            initial={reduce ? false : "hidden"}
            animate="show"
            exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            // 1 per row on mobile, 2 on tablet, 3 on desktop; a single pooja sits in the centre.
            className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {shown.map((p, i) => {
              const c = catByKey.get(p.category);
              return (
                <motion.li
                  key={p.id}
                  className={cn(shown.length === 1 && "md:col-span-2 md:mx-auto md:w-1/2 lg:col-span-3 lg:w-1/3")}
                  variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
                >
                  <PoojaCard p={p} categoryName={c?.name} categoryIcon={c?.icon} priority={i < 2} size="lg" />
                </motion.li>
              );
            })}
          </motion.ul>
        </AnimatePresence>

        {/* how it works */}
        <ol className="mt-4 grid overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_14px_36px_-30px_rgba(36,26,59,0.45)] sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className={cn("flex items-start gap-3 p-4", i > 0 && "border-t border-foreground/8 sm:border-l sm:border-t-0")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_10px_22px_-12px_rgba(201,148,42,0.9)]">
                <s.icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-600">Step {i + 1}</span>
                <span className="block text-sm font-semibold text-foreground">{s.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex justify-center">
          <ButtonLink href={activeCat ? `${C.base}?category=${activeCat.slug}` : C.base} variant="gold" size="md" className="gap-1.5">
            {activeCat ? `View all ${activeCat.name} ${C.many}` : C.all} <ArrowRight size={15} />
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}

function Chip({ active, onClick, icon: I, label, count }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ size?: number }>; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
        active
          ? "border-transparent bg-gradient-to-r from-gold-400 to-gold-500 text-white shadow-[0_8px_20px_-10px_rgba(201,148,42,0.8)]"
          : "border-foreground/10 bg-white text-foreground hover:border-gold-400/50",
      )}
    >
      <I size={14} />
      {label}
      <span className={cn("rounded-full px-1.5 text-[10.5px] tabular-nums", active ? "bg-white/25" : "bg-foreground/5 text-muted")}>{count}</span>
    </button>
  );
}
