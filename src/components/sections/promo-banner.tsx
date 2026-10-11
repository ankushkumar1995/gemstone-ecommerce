"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

/**
 * Cinematic "Stone of the Month" promo banner with a scroll-driven parallax
 * image. The background drifts slower than the page for depth.
 */
export interface PromoBannerData {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const FALLBACK: PromoBannerData = {
  eyebrow: "Stone of the Month",
  title: "Blue Sapphire — Neelam Festival",
  subtitle:
    "The fastest-acting gem of Saturn — now up to 30% off on certified, unheated Ceylon sapphires. Limited stock this season.",
  image:
    "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=2000&q=85",
  ctaLabel: "Shop the Offer",
  ctaHref: "/shop?category=loose-stones",
};

export function PromoBanner({ banner }: { banner?: PromoBannerData | null }) {
  const b = banner ?? FALLBACK;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Background image drifts upward as the section scrolls through the viewport.
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.15, 1.3]);

  return (
    <section className="py-10">
      <Container>
        <div
          ref={ref}
          className="relative overflow-hidden rounded-[2rem] border border-foreground/10"
        >
          {/* Parallax background */}
          <motion.div style={{ y, scale }} className="absolute inset-0">
            <Image
              src={b.image || FALLBACK.image!}
              alt={b.title}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>

          {/* Readability + mood scrims */}
          <div className="absolute inset-0 bg-gradient-to-r from-cosmos/95 via-cosmos/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-cosmos/80 via-transparent to-transparent" />

          {/* Content */}
          <div className="relative grid min-h-[22rem] items-center px-6 py-14 sm:px-12 md:min-h-[26rem]">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl"
            >
              {b.eyebrow && (
                <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
                  <Sparkles size={13} />
                  {b.eyebrow}
                </span>
              )}

              <h2 className="mt-5 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl md:text-5xl">
                {b.title}
              </h2>

              {b.subtitle && (
                <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
                  {b.subtitle}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href={b.ctaHref || "/shop"}>
                  <Button variant="gold" size="lg">
                    {b.ctaLabel || "Shop Now"} <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link
                  href="/shop"
                  className="text-sm font-semibold text-foreground/80 underline-offset-4 transition-colors hover:text-gold-600 hover:underline"
                >
                  Explore all stones
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
