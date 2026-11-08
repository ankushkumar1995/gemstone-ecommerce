"use client";

/**
 * Shared storefront pieces for poojas: category icons, date formatting and
 * the premium pooja card used on the homepage, the listing and "related".
 */

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity, ArrowRight, Briefcase, CalendarDays, Clock, Coins, Flame, Flower2, Gem, GraduationCap, Heart, Leaf, MapPin, Moon,
  Mountain, Shield, Sparkles, Star, Sun, Users, type LucideIcon,
} from "lucide-react";
import type { PublicPooja } from "@/modules/poojas/pooja.types";
import { useCurrency } from "@/lib/currency";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const POOJA_ICON: Record<string, LucideIcon> = {
  Flame, Sparkles, Sun, Moon, Star, Heart, Coins, Briefcase, GraduationCap, Shield, Activity, Users, Leaf, Gem, Flower2, Mountain,
};
export const poojaIcon = (name?: string): LucideIcon => (name && POOJA_ICON[name]) || Flame;

/** Category icon by name (a fixed component, safe to render anywhere). */
export function PoojaIcon({ name, size = 14, className }: { name?: string; size?: number; className?: string }) {
  const I = POOJA_ICON[name ?? ""] ?? Flame;
  return <I size={size} className={className} />;
}

/** "2026-11-14" → "Sat, 14 Nov". Dates are IST calendar days, so format in UTC. */
export function fmtDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
}
/** "18:30" → "6:30 PM"; "any" → "". */
export function fmtTime(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
}
export function poojaPlace(p: Pick<PublicPooja, "location">) {
  return [p.location.place, p.location.city].filter(Boolean).join(", ") || (p.location.mode === "our_pandits" ? "Performed by our pandits" : "");
}
export const offPct = (price: number, mrp: number | null) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

/** Words and URLs per ritual type, so pooja and havan pages never mix. */
export const RITUAL = {
  pooja: { noun: "Pooja", plural: "Poojas", lower: "pooja", base: "/pooja", cta: "Book Pooja" },
  havan: { noun: "Havan", plural: "Havans", lower: "havan", base: "/havan", cta: "Book Havan" },
} as const;
export const ritualOf = (p: { type?: string }) => RITUAL[p.type === "havan" ? "havan" : "pooja"];
/** "11-day anushthan · Samuhik" for havans, "" for poojas. */
export function havanBadge(p: Pick<PublicPooja, "type" | "havan">) {
  if (p.type !== "havan") return "";
  const d = p.havan.durationDays;
  return `${d > 1 ? `${d}-day anushthan` : "1-day havan"} · ${p.havan.mode === "ekal" ? "Ekal" : "Samuhik"}`;
}
/** Biggest jaap count among packages, e.g. "Up to 1,25,000 jaap". */
export function maxJaap(p: Pick<PublicPooja, "packages">) {
  const n = Math.max(0, ...p.packages.map((x) => x.jaapCount ?? 0));
  return n > 0 ? n : null;
}

export type NextSlot = { date: string; time: string; label: string } | null;
export type CardPooja = PublicPooja & { next?: NextSlot };

/** "Next: Sat, 14 Nov" (or the festival label when the date has one). */
export const nextLabel = (n?: NextSlot) => (n ? `${n.label ? `${n.label} · ` : "Next: "}${fmtDay(n.date)}` : "");

export function PoojaCard({ p, categoryName, categoryIcon, priority, size = "md" }: { p: CardPooja; categoryName?: string; categoryIcon?: string; priority?: boolean; size?: "md" | "lg" }) {
  const lg = size === "lg";
  const R = ritualOf(p);
  const hb = havanBadge(p);
  const jaap = p.type === "havan" ? maxJaap(p) : null;
  const { format } = useCurrency();
  const reduce = useReducedMotion();
  const off = offPct(p.priceFrom, p.mrpFrom);
  const place = poojaPlace(p);

  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_18px_44px_-32px_rgba(36,26,59,0.45)] transition-[border-color,box-shadow] duration-300 hover:border-gold-400/50 hover:shadow-[0_28px_60px_-30px_rgba(201,148,42,0.55)]"
    >
      <div className={cn("relative overflow-hidden bg-gradient-to-br from-gold-400/25 to-royal-500/20", lg ? "aspect-[16/9]" : "aspect-[4/3]")}>
        {p.coverImage ? (
          <Image
            src={p.coverImage}
            alt={p.title}
            fill
            priority={priority}
            sizes={lg ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-gold-600"><Flame size={48} strokeWidth={1.3} /></span>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        {/* warm glow on hover */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(230,180,58,0.45),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {categoryName ? (
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-gold-700 shadow-sm backdrop-blur">
              <PoojaIcon name={categoryIcon} size={11} /> {categoryName}
            </span>
          ) : <span />}
          {off > 0 ? (
            <span className="rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">{off}% off</span>
          ) : p.featured ? (
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <Star size={10} className="fill-white" /> Featured
            </span>
          ) : null}
        </div>

        <div className="absolute inset-x-3 bottom-2.5 text-white">
          {p.deity && <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">{p.deity}</p>}
          {place && <p className="mt-0.5 flex items-center gap-1 text-[12px] text-white/85"><MapPin size={12} className="shrink-0" /><span className="truncate">{place}</span></p>}
        </div>
      </div>

      <div className={cn("flex flex-1 flex-col", lg ? "p-5" : "p-3.5")}>
        <h3 className={cn("font-semibold leading-snug text-foreground", lg ? "text-[1.2rem]" : "text-[15.5px]")}>
          {/* Stretched link: the whole card opens the pooja */}
          <Link
            href={`${R.base}/${p.slug}`}
            className="line-clamp-2 transition-colors after:absolute after:inset-0 after:content-[''] hover:text-gold-600 focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-gold-400/60"
          >
            {p.title}
          </Link>
        </h3>
        {lg && (p.shortDescription || p.subtitle) ? (
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{p.shortDescription || p.subtitle}</p>
        ) : p.subtitle ? (
          <p className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{p.subtitle}</p>
        ) : null}

        <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-muted", lg ? "mt-3 text-[12.5px]" : "mt-2.5 text-[11.5px]")}>
          <span className="flex items-center gap-1"><Clock size={12} className="text-gold-500" /> {fmtDuration(p.durationMin)}</span>
          <span className="flex items-center gap-1"><Users size={12} className="text-gold-500" /> {p.panditCount} pandit{p.panditCount > 1 ? "s" : ""}</span>
          {p.next && <span className="flex items-center gap-1 font-medium text-emerald-700"><CalendarDays size={12} /> {nextLabel(p.next)}</span>}
          {hb && <span className="flex items-center gap-1 font-medium text-gold-700"><Flame size={12} /> {hb}</span>}
          {jaap && <span className="flex items-center gap-1"><Sparkles size={12} className="text-gold-500" /> Up to {jaap.toLocaleString("en-IN")} jaap</span>}
        </div>

        {/* pt keeps a gap above the divider even when the card is full */}
        <div className="mt-auto pt-3.5">
          <div className={cn("flex items-end justify-between gap-2 border-t border-foreground/8", lg ? "pt-4" : "pt-3")}>
            <div className="min-w-0">
              <p className={cn("text-muted", lg ? "text-[11.5px]" : "text-[10.5px]")}>Starting from</p>
              <p className="flex items-baseline gap-1.5">
                <span className={cn("font-bold text-foreground", lg ? "text-[1.35rem]" : "text-[17px]")}>{format(p.priceFrom)}</span>
                {p.mrpFrom && <span className="text-[12px] text-muted line-through">{format(p.mrpFrom)}</span>}
              </p>
            </div>
            <ButtonLink href={`${R.base}/${p.slug}#book`} aria-label={`Book ${p.title}`} variant="gold" size={lg ? "md" : "sm"} className="relative z-10 shrink-0 gap-1.5">
              {R.cta} <ArrowRight size={lg ? 15 : 13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
