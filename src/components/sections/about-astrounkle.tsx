"use client";

/**
 * Homepage "About Astrounkle" section (astrology-first).
 *
 * Left: layered image collage with a slowly turning zodiac ring and two
 * floating trust chips. Right: story, four pillars and CTAs. Below: a stats
 * strip whose numbers count up once when scrolled into view.
 * All motion is disabled for users who prefer reduced motion.
 */

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, animate, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Lock, ScrollText, Sparkles, Star, Users, HeartHandshake, CalendarCheck2, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

const pillars: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BadgeCheck, title: "Verified astrologers", text: "Every astrologer is screened for experience and knowledge." },
  { icon: ScrollText, title: "Authentic Vedic method", text: "Readings from your exact birth chart, dashas and transits." },
  { icon: HeartHandshake, title: "Practical remedies", text: "Simple, doable guidance. No fear, no pressure selling." },
  { icon: Lock, title: "100% private", text: "Your birth details and conversations stay confidential." },
];

const stats: { icon: LucideIcon; to: number; decimals?: number; suffix: string; label: string }[] = [
  { icon: Users, to: 25000, suffix: "+", label: "Consultations done" },
  { icon: Star, to: 4.9, decimals: 1, suffix: "★", label: "Average rating" },
  { icon: CalendarCheck2, to: 15, suffix: "+", label: "Years of practice" },
  { icon: Lock, to: 100, suffix: "%", label: "Private & secure" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function AboutAstrounkle() {
  const reduce = useReducedMotion();

  return (
    <section id="about" aria-labelledby="about-title" className="relative scroll-mt-24 overflow-hidden py-9 md:py-11">
      {/* soft brand glow */}
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-royal-400/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />

      <Container className="relative">
        {/* Same header as every homepage section */}
        <SectionHeader
          eyebrow="About Us"
          title={
            <span id="about-title">
              Why Thousands Trust <span className="text-gradient-gold">Astrounkle</span>
            </span>
          }
          description="Experienced Vedic astrologers, honest guidance and practical remedies for every turn of life."
        />

        {/* Same gutters as every section: columns start at the Container edge. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
          {/* ---------------- Collage ---------------- */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
            className="relative w-full"
          >
            {/* Image fills the column; on desktop it matches the text height. */}
            <div className="relative aspect-[16/11] overflow-hidden rounded-2xl border border-foreground/10 shadow-[0_26px_60px_-34px_rgba(36,26,59,0.55)] lg:aspect-auto lg:h-full lg:min-h-[26rem]">
              {/* turning zodiac ring (kept inside the card) */}
              <motion.div
                aria-hidden
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                className="pointer-events-none absolute -right-10 -top-10 z-[1] h-40 w-40 text-white/35 sm:h-44 sm:w-44"
              >
                <ZodiacRing />
              </motion.div>
              <Image
                src="/images/Mystical Vedic Astrology Consultation.png"
                alt="A Vedic astrologer reading a birth chart during a consultation"
                fill
                sizes="(max-width: 1024px) 90vw, 34rem"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <p className="absolute bottom-4 left-4 right-28 font-display text-base font-semibold leading-snug text-white drop-shadow sm:right-36 sm:text-lg">
                “The stars don’t decide your life. They help you understand it.”
              </p>

              {/* inset second image (inside the card, never overflows the gutter) */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.15, ease }}
                className="absolute bottom-3 right-3 aspect-square w-24 overflow-hidden rounded-xl border-[3px] border-white/90 shadow-xl sm:w-32"
              >
                <Image src="/images/Celestial Gemstone Temple Still Life.png" alt="" fill sizes="128px" className="object-cover" />
              </motion.div>
            </div>

            {/* trust chip: experience */}
            <FloatChip className="left-3 top-3" delay={0.25} reduce={reduce}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-sm">
                <Sparkles size={17} />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-foreground">15+ years</span>
                <span className="block text-[11px] text-muted">of Vedic practice</span>
              </span>
            </FloatChip>

            {/* trust chip: rating */}
            <FloatChip className="left-3 top-[4.25rem]" delay={0.4} reduce={reduce}>
              <span className="flex" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className="fill-gold-500 text-gold-500" />
                ))}
              </span>
              <span className="text-[12px] font-semibold text-foreground">4.9 / 5 rating</span>
            </FloatChip>
          </motion.div>

          {/* ---------------- Story ---------------- */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
            className="flex flex-col justify-center"
          >
            <h3 className="font-display text-xl font-semibold leading-snug text-foreground sm:text-[1.4rem]">
              Ancient Vedic wisdom, <span className="text-gradient-gold">guidance for modern life</span>
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Astrounkle brings you to experienced Vedic astrologers who read your birth chart with care and
              explain it in plain words. Whether it is career, marriage, health or money, we help you see
              what the planets are saying and what you can actually do about it.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              No fear-based predictions and no pushy upselling. Just honest guidance, practical remedies and an
              astrologer who listens.
            </p>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {pillars.map((p, i) => (
                <motion.div
                  key={p.title}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: 0.08 * i, ease }}
                  className="group flex items-start gap-3 rounded-2xl border border-foreground/10 bg-white p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-[0_18px_40px_-28px_rgba(122,69,245,0.45)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/12 to-gold-400/20 text-gold-600 transition-colors duration-300 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white">
                    <p.icon size={17} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{p.title}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{p.text}</span>
                  </span>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ButtonLink href="/#free-consultation" variant="gold" size="md" className="gap-1.5">
                Talk to an Astrologer <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href="/services" variant="outline" size="md">
                Explore Services
              </ButtonLink>
            </div>
          </motion.div>
        </div>

        {/* ---------------- Stats ---------------- */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
          className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_20px_50px_-34px_rgba(36,26,59,0.45)] lg:grid-cols-4"
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={[
                "flex items-center gap-3 px-4 py-4 sm:px-5",
                i % 2 === 0 ? "border-r border-foreground/8" : "",
                i < 2 ? "border-b border-foreground/8 lg:border-b-0" : "",
                i === 1 ? "lg:border-r" : "",
              ].join(" ")}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/12 to-gold-400/20 text-gold-600">
                <s.icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xl font-semibold text-gradient-gold sm:text-2xl">
                  <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
                </span>
                <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-muted sm:text-xs">{s.label}</span>
              </span>
            </div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}

function FloatChip({ className, delay, reduce, children }: { className: string; delay: number; reduce: boolean | null; children: React.ReactNode }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease }}
      className={`absolute z-10 flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Counts up once when visible. Writes to the DOM directly (no re-renders). */
function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) { el.textContent = fmt(to); return; }
    const controls = animate(0, to, { duration: 1.6, ease: "easeOut", onUpdate: (v) => { el.textContent = fmt(v); } });
    return () => controls.stop();
    // fmt depends only on decimals/suffix, already listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, to, decimals, suffix, reduce]);

  // Server and first paint show the final value, so no-JS and SEO are correct.
  return <span ref={ref}>{fmt(to)}</span>;
}

/** Decorative zodiac wheel (12 segments + glyph dots). */
function ZodiacRing() {
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" className="h-full w-full">
      <circle cx="100" cy="100" r="96" strokeWidth="1" />
      <circle cx="100" cy="100" r="78" strokeWidth="0.8" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="58" strokeWidth="0.8" />
      {ticks.map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = 100 + 58 * Math.cos(r), y1 = 100 + 58 * Math.sin(r);
        const x2 = 100 + 96 * Math.cos(r), y2 = 100 + 96 * Math.sin(r);
        const m = ((a + 15) * Math.PI) / 180;
        return (
          <g key={a}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="0.8" />
            <circle cx={100 + 87 * Math.cos(m)} cy={100 + 87 * Math.sin(m)} r="2.2" fill="currentColor" stroke="none" />
          </g>
        );
      })}
      <path d="M100 82 L104 96 L118 100 L104 104 L100 118 L96 104 L82 100 L96 96 Z" fill="currentColor" stroke="none" opacity="0.7" />
    </svg>
  );
}
