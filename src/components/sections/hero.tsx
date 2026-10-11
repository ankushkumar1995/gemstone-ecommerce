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
  focus: string;
}

const slides: Slide[] = [
  {
    id: "cosmic",
    eyebrow: "Guided by the stars, crafted for you",
    titleTop: "Wear Your",
    titleAccent: "Cosmic Destiny",
    description:
      "Certified natural gemstones, matched to your zodiac and crafted into timeless luxury jewellery. Authentic. Energised. Yours.",
    primaryCta: { label: "Explore Collection", href: "/shop" },
    secondaryCta: { label: "Find My Stone", href: "/#zodiac" },
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=2400&q=85",
    focus: "center",
  },
  {
    id: "ruby",
    eyebrow: "The gem of the Sun",
    titleTop: "Ignite Your",
    titleAccent: "Inner Power",
    description:
      "Discover our signature ruby & gold collection — hand-set, IGI certified, and radiant with the energy of confidence and vitality.",
    primaryCta: { label: "Shop Rings", href: "/shop?category=rings" },
    secondaryCta: { label: "View Bestsellers", href: "/shop" },
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=2400&q=85",
    focus: "center",
  },
  {
    id: "sapphire",
    eyebrow: "Fortune favours the bold",
    titleTop: "Rare & Radiant",
    titleAccent: "Certified Stones",
    description:
      "Unheated Ceylon sapphires, emeralds and loose gems — investment-grade, lab certified, and impossibly brilliant.",
    primaryCta: { label: "Shop Loose Stones", href: "/shop?category=loose-stones" },
    secondaryCta: { label: "Talk to an Expert", href: "/#zodiac" },
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=2400&q=85",
    focus: "center",
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
              animate={{ scale: [1.0, 1.14] }}
              transition={{ duration: AUTOPLAY_MS / 1000 + 2, ease: "linear" }}
            >
              <Image
                src={slide.image}
                alt={`${slide.titleTop} ${slide.titleAccent}`}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: slide.focus }}
              />
            </motion.div>
            {/* readability scrims */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
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
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
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
                  className="mt-6 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg"
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
        <div className="absolute bottom-7 left-0 right-0 z-20 flex items-center justify-center gap-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="group relative h-2 overflow-hidden rounded-full transition-all duration-300"
              style={{ width: i === index ? 56 : 22 }}
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
      <div className="mx-auto -mt-8 w-full max-w-7xl px-5 sm:px-8">
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
              className={`py-6 text-center ${
                i < stats.length - 1 ? "border-r border-foreground/10" : ""
              }`}
            >
              <div className="font-display text-3xl font-semibold text-gradient-gold sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-medium text-muted sm:text-sm">
                {s.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
