"use client";

/**
 * Havan-only blocks for the detail page:
 *   • HavanInfo  mode, days, kund, live darshan, samagri, what you receive,
 *                and a day-by-day strip for multi-day anushthans
 *   • TierLine   jaap / ahuti / pandits of a package
 */

import { motion, useReducedMotion } from "framer-motion";
import { CalendarRange, Flame, Gift, Radio, Users, User, Sparkles, Check } from "lucide-react";
import type { PoojaPackage, PublicPooja } from "@/modules/poojas/pooja.types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function HavanInfo({ pooja }: { pooja: PublicPooja }) {
  const reduce = useReducedMotion();
  const h = pooja.havan;
  const ekal = h.mode === "ekal";
  const facts = [
    { icon: ekal ? User : Users, label: "Performed as", value: ekal ? "Ekal (only for you)" : "Samuhik (group)" },
    { icon: CalendarRange, label: "Duration", value: h.durationDays > 1 ? `${h.durationDays}-day anushthan` : "Single-day havan" },
    { icon: Flame, label: "Havan kund", value: `${h.kundCount} kund${h.kundCount > 1 ? "s" : ""}` },
    { icon: Radio, label: "Darshan", value: h.liveUrl ? "Live + recording" : "Full recording" },
  ];
  const days = Math.min(h.durationDays, 21);

  return (
    <motion.section
      aria-labelledby="havan-info-title"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease }}
      className="relative mt-8 overflow-hidden rounded-3xl border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.10] via-white to-rose-400/[0.06] p-5 shadow-[0_24px_60px_-40px_rgba(201,148,42,0.7)] sm:p-6"
    >
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gold-400/20 blur-3xl" />
      <h2 id="havan-info-title" className="relative flex items-center gap-2 text-lg font-semibold text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-sm"><Flame size={17} /></span>
        About this havan
      </h2>

      <dl className="relative mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="group rounded-xl border border-white/80 bg-white/80 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/50 hover:shadow-[0_14px_30px_-20px_rgba(201,148,42,0.8)]">
            <f.icon size={16} className="text-gold-500 transition-transform duration-300 group-hover:scale-110" />
            <dt className="mt-1.5 text-[10.5px] uppercase tracking-wider text-muted">{f.label}</dt>
            <dd className="text-[13.5px] font-semibold text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>

      {h.durationDays > 1 && (
        <div className="relative mt-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">How the anushthan runs</p>
          <ol className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {Array.from({ length: days }).map((_, i) => {
              const last = i === days - 1;
              return (
                <motion.li
                  key={i}
                  initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className={cn("flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center", last ? "border-gold-400 bg-gradient-to-b from-gold-400 to-gold-500 text-white" : "border-foreground/10 bg-white")}
                >
                  <span className={cn("text-[10px] font-semibold uppercase", last ? "text-white/85" : "text-muted")}>Day</span>
                  <span className="text-base font-bold leading-tight">{i + 1}</span>
                  <span className={cn("text-[10px]", last ? "text-white/90" : "text-muted")}>{last ? "Purnahuti" : i === 0 ? "Sankalp" : "Jaap"}</span>
                </motion.li>
              );
            })}
            {h.durationDays > days && <li className="flex shrink-0 items-center px-2 text-xs text-muted">+{h.durationDays - days} more</li>}
          </ol>
          <p className="mt-2 text-[12.5px] text-muted">You get a short update every day with the jaap completed, and the full purnahuti video at the end.</p>
        </div>
      )}

      <div className="relative mt-4 grid gap-4 md:grid-cols-2">
        {h.samagri.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Sparkles size={15} className="text-gold-500" /> Samagri offered</p>
            <ul className="flex flex-wrap gap-1.5">
              {h.samagri.map((s) => <li key={s} className="rounded-full border border-gold-400/30 bg-white px-2.5 py-1 text-[12px] text-foreground/85">{s}</li>)}
            </ul>
          </div>
        )}
        {h.deliverables.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Gift size={15} className="text-gold-500" /> You receive</p>
            <ul className="space-y-1.5">
              {h.deliverables.map((d) => (
                <li key={d} className="flex items-center gap-2 text-[13px] text-foreground">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Check size={12} strokeWidth={2.6} /></span>{d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.section>
  );
}

/** "51,000 jaap · 1,008 ahuti · 5 pandits" chips for a havan package. */
export function TierLine({ pkg, light }: { pkg: Pick<PoojaPackage, "jaapCount" | "ahutiCount" | "panditCount">; light?: boolean }) {
  const parts = [
    pkg.jaapCount ? `${pkg.jaapCount.toLocaleString("en-IN")} jaap` : "",
    pkg.ahutiCount ? `${pkg.ahutiCount.toLocaleString("en-IN")} ahuti` : "",
    pkg.panditCount ? `${pkg.panditCount} pandit${pkg.panditCount > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {parts.map((p) => (
        <span key={p} className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", light ? "bg-white/25 text-white" : "bg-gold-400/12 text-gold-700")}>{p}</span>
      ))}
    </span>
  );
}
