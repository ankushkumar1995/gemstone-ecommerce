"use client";

/**
 * /pooja bottom sections:
 *   • Why book with us: six reasons with icon cards and hover effects
 *   • Testimonials: review cards with rating, pooja name and a quote mark
 */

import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, CalendarRange, Flame, Landmark, Lock, Package, Quote, Radio, ScrollText, Star, Video, type LucideIcon } from "lucide-react";
import type { RitualType } from "@/modules/poojas/pooja.types";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { HAVAN_TESTIMONIALS, POOJA_TESTIMONIALS } from "@/data/pooja-testimonials";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const HAVAN_REASONS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BadgeCheck, title: "Learned Vedic acharyas", text: "Havans are led by experienced acharyas who know the exact mantras, ahutis and kund vidhi." },
  { icon: Flame, title: "Pure samagri", text: "Desi ghee, mango wood samidha, til, jau and herbs as per shastra. The full samagri list is shown upfront." },
  { icon: CalendarRange, title: "Daily anushthan updates", text: "For multi-day anushthans you get an update every day with the jaap completed so far." },
  { icon: Radio, title: "Live darshan & video", text: "Watch the havan live where available, and receive the full purnahuti video afterwards." },
  { icon: Package, title: "Bhasma at your home", text: "Havan bhasma, raksha sutra and prasad couriered to your address across India." },
  { icon: Lock, title: "Ekal or samuhik, your choice", text: "An exclusive havan only for your family, or an affordable group havan. Clear price either way." },
];

const REASONS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BadgeCheck, title: "Learned, verified pandits", text: "Every pooja is done by experienced Vedic pandits who follow the complete shastra vidhi." },
  { icon: Landmark, title: "At sacred temples", text: "Poojas at holy places like Kashi, Ujjain and Haridwar, or by our pandits on the date you pick." },
  { icon: ScrollText, title: "Sankalp in your name", text: "Your name, gotra and wish are spoken in the sankalp, exactly as you share them." },
  { icon: Video, title: "Video of your pooja", text: "Watch the full pooja video with your sankalp, shared on WhatsApp after the ritual." },
  { icon: Package, title: "Prasad at your home", text: "Blessed prasad, tilak and raksha sutra couriered to your address across India." },
  { icon: Lock, title: "Clear price, no surprises", text: "One price shown upfront. No hidden charges and your details are always kept private." },
];

export function PoojaWhy({ type = "pooja" }: { type?: RitualType }) {
  const reduce = useReducedMotion();
  const havan = type === "havan";
  const reasons = havan ? HAVAN_REASONS : REASONS;
  return (
    <section aria-labelledby="why-pooja-title" className="relative overflow-hidden py-9 md:py-11">
      <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-gold-400/12 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-rose-400/10 blur-3xl" />
      <Container className="relative">
        <SectionHeader
          eyebrow="Why Astrounkle"
          title={<span id="why-pooja-title">Why Book Your {havan ? "Havan" : "Pooja"} <span className="text-gradient-gold">With Us</span></span>}
          description={havan ? "Every havan is offered with devotion, pure samagri, the right vidhi and complete transparency." : "Every pooja is performed with devotion, the right vidhi and complete transparency."}
        />
        <motion.ul
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {reasons.map((r, i) => (
            <motion.li
              key={r.title}
              variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}
              whileHover={reduce ? undefined : { y: -5 }}
              className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(36,26,59,0.5)] transition-[border-color,box-shadow] duration-300 hover:border-gold-400/50 hover:shadow-[0_26px_56px_-30px_rgba(201,148,42,0.55)]"
            >
              {/* warm diya glow on hover */}
              <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/0 blur-2xl transition-colors duration-500 group-hover:bg-gold-400/25" />
              <span aria-hidden className="pointer-events-none absolute right-4 top-4 text-foreground/[0.06] transition-all duration-500 group-hover:rotate-12 group-hover:text-gold-400/30">
                <Flame size={44} strokeWidth={1.4} />
              </span>

              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400/20 to-rose-400/15 text-gold-600 transition-all duration-300 group-hover:scale-105 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white group-hover:shadow-[0_10px_22px_-10px_rgba(201,148,42,0.9)]">
                <r.icon size={20} />
              </span>
              <h3 className="relative mt-3.5 text-[15.5px] font-semibold text-foreground">{r.title}</h3>
              <p className="relative mt-1 text-[13.5px] leading-relaxed text-muted">{r.text}</p>
              <span aria-hidden className="absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-gold-400 via-gold-500 to-rose-400 transition-transform duration-500 group-hover:scale-x-100 motion-reduce:transition-none" />
              <span className="sr-only">Reason {i + 1}</span>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}

export function PoojaTestimonials({ type = "pooja" }: { type?: RitualType }) {
  const reduce = useReducedMotion();
  const havan = type === "havan";
  const list = havan ? HAVAN_TESTIMONIALS : POOJA_TESTIMONIALS;
  const avg = list.reduce((s, t) => s + t.rating, 0) / list.length;

  return (
    <section aria-labelledby="pooja-reviews-title" className="relative overflow-hidden bg-gradient-to-b from-gold-400/[0.07] to-transparent py-9 md:py-11">
      <Container className="relative">
        <SectionHeader
          eyebrow="Devotee Stories"
          title={<span id="pooja-reviews-title">What Devotees <span className="text-gradient-gold">Say About Us</span></span>}
          description={`Families across India who booked their ${havan ? "havan and yagya" : "pooja"} with Astrounkle.`}
        />
        <div className="mt-4 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-foreground shadow-sm">
            <span className="flex" aria-hidden>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className="fill-gold-500 text-gold-500" />)}</span>
            {avg.toFixed(1)} average from devotees
          </span>
        </div>

        <motion.ul
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
        >
          {list.map((t) => (
            <motion.li
              key={t.name + t.pooja}
              variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}
              whileHover={reduce ? undefined : { y: -5 }}
              className="group relative flex w-[82%] shrink-0 snap-start flex-col rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(36,26,59,0.5)] transition-[border-color,box-shadow] duration-300 hover:border-gold-400/50 hover:shadow-[0_26px_56px_-30px_rgba(201,148,42,0.55)] sm:w-[60%] md:w-auto"
            >
              <Quote aria-hidden size={40} className="absolute right-4 top-4 text-gold-400/15 transition-all duration-500 group-hover:-rotate-6 group-hover:text-gold-400/35" />

              <div className="flex items-center gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className={cn(i < t.rating ? "fill-gold-500 text-gold-500" : "text-foreground/20")} />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-[14px] leading-relaxed text-foreground/85">“{t.text}”</blockquote>

              <div className="mt-4 flex items-center gap-3 border-t border-foreground/8 pt-4">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-rose-400 text-sm font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                  {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {t.name} <BadgeCheck size={14} className="shrink-0 text-emerald-600" aria-label="Verified booking" />
                  </p>
                  <p className="truncate text-[12px] text-muted">{t.city} · <span className="font-medium text-gold-700">{t.pooja}</span></p>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}
