"use client";

/**
 * Homepage "Meet our astrologers" section.
 *
 * Five consistent profile cards (one row on desktop, swipeable row on
 * smaller screens). Hover: lift, gold ring, cursor-following glow, image
 * zoom and the expertise chips slide up. Motion is off for reduced-motion.
 *
 * Names, roles and numbers below are placeholders for the photos in
 * /public/astrologers; replace them with the real astrologer details.
 */

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Star, ArrowRight, BadgeCheck, Languages, BriefcaseBusiness, MessageCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { ConsultationModal } from "@/components/astrology/consultation-modal";
import { cn } from "@/lib/utils";

interface Astrologer {
  name: string;
  role: string;
  image: string;
  rating: number;
  reviews: string;
  years: number;
  languages: string;
  skills: string[];
  online?: boolean;
  top?: string;
}

const astrologers: Astrologer[] = [
  { name: "Acharya Vihaan Ji", role: "Chief Vedic Astrologer", image: "/astrologers/a7.webp", rating: 4.9, reviews: "12.4k", years: 20, languages: "Hindi, English", skills: ["Vedic", "Kundli", "Career"], online: true, top: "Top Rated" },
  { name: "Astrologer Meera Ji", role: "Kundli & Marriage Expert", image: "/astrologers/a12.webp", rating: 4.9, reviews: "8.1k", years: 15, languages: "Hindi, English", skills: ["Marriage", "Matching", "Love"], online: true },
  { name: "Pandit Rishabh Ji", role: "Vastu & Muhurat Specialist", image: "/astrologers/a10.webp", rating: 4.8, reviews: "5.6k", years: 10, languages: "Hindi, Sanskrit", skills: ["Vastu", "Muhurat", "Puja"] },
  { name: "Guru Saraswati Ji", role: "Senior Jyotish Acharya", image: "/astrologers/a5-avatar.webp", rating: 5.0, reviews: "9.8k", years: 25, languages: "Hindi, Marathi", skills: ["Health", "Remedies", "Dasha"], top: "Top 1%" },
  { name: "Astrologer Aditi Ji", role: "Numerology & Tarot", image: "/astrologers/a9-avatar.webp", rating: 4.8, reviews: "3.9k", years: 8, languages: "Hindi, English", skills: ["Numerology", "Tarot", "Finance"], online: true },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function Astrologers() {
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<Astrologer | null>(null);
  // Stable, so the dialog's focus/scroll-lock effect runs once per open.
  const closeModal = useCallback(() => setPicked(null), []);

  return (
    <section aria-labelledby="astro-title" className="relative overflow-hidden py-9 md:py-11">
      <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-royal-500/10 blur-3xl" />

      <Container className="relative">
        <SectionHeader
          eyebrow="Meet Our Experts"
          title={
            <span id="astro-title">
              Real Astrologers. <span className="text-gradient-gold">Real Guidance.</span>
            </span>
          }
          description="Talk one-on-one with verified Vedic astrologers for career, marriage, health and the decisions that can't wait."
        />

        {/* Swipe row below lg, five equal columns on desktop */}
        <motion.ul
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {astrologers.map((a, i) => (
            <motion.li
              key={a.name}
              variants={{ hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } } }}
              className="w-[72%] shrink-0 snap-start sm:w-[42%] md:w-[31%] lg:w-auto"
            >
              <AstrologerCard astro={a} priority={i < 2} reduce={reduce} onConsult={setPicked} />
            </motion.li>
          ))}
        </motion.ul>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/astrologers" variant="gold" size="md" className="gap-1.5">
            View All Astrologers <ArrowRight size={15} />
          </ButtonLink>
          <a href={WA} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-500">
            <MessageCircle size={15} /> Not sure who to pick? Chat with us
          </a>
        </div>
      </Container>

      <ConsultationModal astrologer={picked} onClose={closeModal} />
    </section>
  );
}

function AstrologerCard({ astro, priority, reduce, onConsult }: { astro: Astrologer; priority: boolean; reduce: boolean | null; onConsult: (a: Astrologer) => void }) {
  const ref = useRef<HTMLElement>(null);

  // Cursor-following glow: CSS variables only, no React re-renders.
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <motion.article
      ref={ref}
      onMouseMove={onMove}
      whileHover={reduce ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_18px_44px_-32px_rgba(36,26,59,0.45)] transition-[border-color,box-shadow] duration-300 hover:border-gold-400/50 hover:shadow-[0_28px_60px_-30px_rgba(122,69,245,0.5)]"
    >
      {/* cursor glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(220px circle at var(--mx, 50%) var(--my, 30%), rgba(230,180,58,0.16), transparent 70%)" }}
      />

      {/* photo */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={astro.image}
          alt={`${astro.name}, ${astro.role}`}
          fill
          priority={priority}
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 40vw, 18vw"
          className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.07]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

        {/* top badges */}
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {astro.online ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-sm backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Online
            </span>
          ) : <span />}
          {astro.top && (
            <span className="rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              {astro.top}
            </span>
          )}
        </div>

        {/* rating + skills (skills slide up on hover) */}
        <div className="absolute inset-x-2.5 bottom-2.5">
          <div className="flex flex-wrap gap-1 transition-all duration-300 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
            {astro.skills.map((s) => (
              <span key={s} className="rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-md">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-white">
            <Star size={13} className="fill-gold-400 text-gold-400" />
            <span className="text-[13px] font-semibold">{astro.rating.toFixed(1)}</span>
            <span className="text-[11px] text-white/75">({astro.reviews} reviews)</span>
          </div>
        </div>
      </div>

      {/* details */}
      <div className="relative z-[2] flex flex-1 flex-col p-3.5">
        <h3 className="flex items-center gap-1 text-[15px] font-semibold leading-snug text-foreground">
          <span className="truncate">{astro.name}</span>
          <BadgeCheck size={15} className="shrink-0 text-royal-500" aria-label="Verified" />
        </h3>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-gold-600">{astro.role}</p>

        <div className="mt-2.5 space-y-1 text-[12px] text-muted">
          <p className="flex items-center gap-1.5"><BriefcaseBusiness size={13} className="shrink-0 text-gold-500" /> {astro.years}+ years experience</p>
          <p className="flex items-center gap-1.5"><Languages size={13} className="shrink-0 text-gold-500" /> <span className="truncate">{astro.languages}</span></p>
        </div>

        <motion.button
          type="button"
          onClick={() => onConsult(astro)}
          aria-label={`Consult ${astro.name}`}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          className={cn(
            "relative mt-3.5 inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 text-sm font-semibold text-white",
            "shadow-[0_10px_24px_-12px_rgba(201,148,42,0.8)] transition-shadow duration-300 hover:shadow-[0_16px_32px_-12px_rgba(201,148,42,0.95)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2",
          )}
        >
          {/* shine sweep on card hover */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/30 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden" />
          <MessageCircle size={15} className="relative" />
          <span className="relative">Consult Now</span>
          <ArrowRight size={15} className="relative transition-transform duration-300 group-hover:translate-x-0.5" />
        </motion.button>
      </div>
    </motion.article>
  );
}
