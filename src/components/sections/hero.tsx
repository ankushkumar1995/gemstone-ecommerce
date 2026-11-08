"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Star,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ *
 * Slide data — each slide is a full-screen image hero theme.
 * Images: Unsplash (free, commercial use).
 * ------------------------------------------------------------------ */
interface Slide {
  id: string;
  eyebrow: string;
  titleTop: string;
  titleAccent: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  image: string;
  /** Optional background video. When set, it plays instead of the image. */
  video?: string;
  focus: string;
  /** Extra left-side darkening for slides whose image is bright on the left. */
  tint?: boolean;
}

const slides: Slide[] = [
  {
    id: "astro",
    eyebrow: "Guided by Vedic wisdom since ancient times",
    titleTop: "Discover What the",
    titleAccent: "Stars Hold for You",
    description:
      "Your birth chart holds the answers. Consult India's trusted Vedic astrologers and wear the one gemstone destined to transform your destiny.",
    primaryCta: { label: "Talk to an Astrologer", href: "/#free-consultation" },
    secondaryCta: { label: "Find My Stone", href: "/gemstone-by-zodiac" },
    image: "/images/image1.png",
    focus: "center",
  },
  {
    id: "gemstone",
    eyebrow: "Certified natural gemstones, chosen for you",
    titleTop: "Energised",
    titleAccent: "Vedic Gemstones",
    description:
      "Authentic, lab-certified natural gemstones matched to your birth chart. Each stone is energised and ready to align your planets in your favour.",
    primaryCta: { label: "Explore Gemstones", href: "/shop" },
    secondaryCta: { label: "Find My Stone", href: "/gemstone-by-zodiac" },
    image: "/images/gemstones-vedic-astrolabe.png",
    focus: "center",
  },
  {
    id: "astrology",
    eyebrow: "Guided by Vedic astrology",
    titleTop: "Rare & Radiant",
    titleAccent: "Certified Stones",
    description:
      "Unheated rubies, blue sapphires, emeralds and yellow sapphires — investment-grade, lab certified, and chosen as per your horoscope.",
    primaryCta: { label: "Shop Loose Stones", href: "/shop?category=loose-stones" },
    secondaryCta: { label: "Talk to an Astrologer", href: "/#free-consultation" },
    image: "/images/vedic-gemstone-astrology.png",
    focus: "center",
  },
  {
    id: "zodiac",
    eyebrow: "Your zodiac, your stone",
    titleTop: "Find Your",
    titleAccent: "Lucky Gemstone",
    description:
      "Every rashi has a gemstone written in the stars. Discover the stone aligned to your zodiac sign and wear the energy meant for you.",
    primaryCta: { label: "Find My Stone", href: "/gemstone-by-zodiac" },
    secondaryCta: { label: "Talk to an Astrologer", href: "/#free-consultation" },
    image: "/images/sunlit-odiac-muse.png",
    focus: "right",
    tint: true,
  },
  {
    id: "consultation",
    eyebrow: "First consultation on us",
    titleTop: "Talk to a",
    titleAccent: "Vedic Astrologer",
    description:
      "Get a personalised reading of your birth chart and the right gemstone remedy from India's trusted Vedic astrologers. Your first consultation is free.",
    primaryCta: { label: "Book Free Consultation", href: "/#free-consultation" },
    secondaryCta: { label: "Explore Gemstones", href: "/shop" },
    image: "/images/serene-vedic-astrology-consultation.png",
    focus: "center",
    tint: true,
  },
];

const stats = [
  { value: "25K+", label: "Happy Customers" },
  { value: "100%", label: "Certified Gems" },
  { value: "4.9★", label: "Avg Rating" },
];

const AUTOPLAY_MS = 6000;

const textContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const textItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function Hero() {
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slide = slides[index];

  const paginate = useCallback((dir: number) => {
    setState(([prev]) => [(prev + dir + slides.length) % slides.length, dir]);
  }, []);

  const goTo = useCallback((next: number) => {
    setState(([prev]) => [next, next > prev ? 1 : -1]);
  }, []);

  useEffect(() => {
    if (paused) return;
    timer.current = setTimeout(() => paginate(1), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, paused, paginate]);

  return (
    <section
      className="relative -mt-[1px] w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* full-screen stage */}
      <div className="relative h-[88vh] min-h-[600px] w-full overflow-hidden">
        {/* ---------------- IMAGE LAYER (Ken Burns) ---------------- */}
        <AnimatePresence mode="sync" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ opacity: { duration: 0.9 }, scale: { duration: 1.2 } }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute inset-0"
              animate={slide.video ? undefined : { scale: [1.0, 1.14] }}
              transition={{ duration: AUTOPLAY_MS / 1000 + 2, ease: "linear" }}
            >
              {slide.video ? (
                <video
                  key={slide.video}
                  src={slide.video}
                  poster={slide.image}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: slide.focus }}
                />
              ) : (
                <Image
                  src={slide.image}
                  alt={`${slide.titleTop} ${slide.titleAccent} — Astrounkle online Vedic astrology & certified gemstones`}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover"
                  style={{ objectPosition: slide.focus }}
                />
              )}
            </motion.div>
            {/* readability scrims — kept light so the image stays clear */}
            <div
              className={`absolute inset-0 bg-gradient-to-r ${
                slide.tint
                  ? "from-black/65 via-black/25 to-transparent"
                  : "from-black/45 via-black/10 to-transparent"
              }`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* floating gold glow */}
        <motion.div
          className="pointer-events-none absolute right-[14%] top-[20%] h-56 w-56 rounded-full bg-gold-400/20 blur-[90px]"
          animate={{ y: [0, -24, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 7, repeat: Infinity }}
        />

        {/* ---------------- CONTENT ---------------- */}
        <div className="relative z-10 flex h-full items-center">
          <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={slide.id}
                variants={textContainer}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
                className="max-w-2xl"
              >
                <motion.div
                  variants={textItem}
                  className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-white/10 px-4 py-1.5 text-xs font-medium text-gold-200 backdrop-blur-md"
                >
                  <Sparkles size={14} />
                  {slide.eyebrow}
                </motion.div>

                <motion.h1
                  variants={textItem}
                  className="font-display text-5xl font-semibold leading-[1.04] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-7xl"
                >
                  {slide.titleTop}
                  <span className="block text-gradient-gold">
                    {slide.titleAccent}
                  </span>
                </motion.h1>

                <motion.p
                  variants={textItem}
                  className="mt-6 max-w-lg text-base leading-relaxed text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)] sm:text-lg"
                >
                  {slide.description}
                </motion.p>

                <motion.div
                  variants={textItem}
                  className="mt-9 flex flex-wrap items-center gap-4"
                >
                  <Link href={slide.primaryCta.href}>
                    <Button variant="gold" size="lg">
                      {slide.primaryCta.label} <ArrowRight size={18} />
                    </Button>
                  </Link>
                  <Link href={slide.secondaryCta.href}>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="border border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
                    >
                      {slide.secondaryCta.label}
                    </Button>
                  </Link>
                </motion.div>

                <motion.div
                  variants={textItem}
                  className="mt-10 flex flex-wrap items-center gap-6"
                >
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <ShieldCheck size={18} className="text-gold-300" />
                    Lab Certified
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className="fill-gold-300 text-gold-300"
                        />
                      ))}
                    </div>
                    Trusted by 25,000+
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ---------------- NAV ARROWS ---------------- */}
        <button
          aria-label="Previous slide"
          onClick={() => paginate(-1)}
          className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/25 sm:left-8"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          aria-label="Next slide"
          onClick={() => paginate(1)}
          className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/25 sm:right-8"
        >
          <ChevronRight size={22} />
        </button>

        {/* ---------------- SLIDE INDICATORS ---------------- */}
        <div className="absolute bottom-10 left-0 right-0 z-20 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="group relative h-1.5 overflow-hidden rounded-full transition-all duration-300"
              style={{ width: i === index ? 44 : 18 }}
            >
              <span className="absolute inset-0 rounded-full bg-white/30" />
              {i === index ? (
                <motion.span
                  key={`${s.id}-${paused}`}
                  className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-gold-300 to-gold-500"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: paused ? 0.35 : 1 }}
                  transition={{
                    duration: paused ? 0.3 : AUTOPLAY_MS / 1000,
                    ease: "linear",
                  }}
                />
              ) : (
                <span className="absolute inset-0 rounded-full bg-white/40 transition-colors group-hover:bg-white/60" />
              )}
            </button>
          ))}
        </div>

      </div>

      {/* ---------------- STATS BAND (below hero, clean) ---------------- */}
      <div className="mx-auto -mt-7 w-full max-w-5xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-30 grid grid-cols-3 overflow-hidden rounded-2xl border border-foreground/10 bg-nebula/90 shadow-[0_24px_60px_-30px_rgba(36,26,59,0.5)] backdrop-blur-md"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              whileHover={{ y: -3 }}
              className={`py-3 text-center ${
                i < stats.length - 1 ? "border-r border-foreground/10" : ""
              }`}
            >
              <div className="font-display text-xl font-semibold text-gradient-gold sm:text-2xl">
                {s.value}
              </div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted sm:text-xs">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
