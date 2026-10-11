"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, Sparkles, Star } from "lucide-react";
import { categories } from "@/data/categories";
import { getFeatured } from "@/data/products";
import { useCurrency } from "@/lib/currency";

/* ------------------------------------------------------------------ *
 * Animation variants
 * ------------------------------------------------------------------ */
const panel: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.05,
      delayChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.99,
    transition: { duration: 0.18, ease: "easeInOut" },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * Ultra-premium mega menu for the "Shop All" entry. Three columns:
 *  - Left: shoppable categories with hover-preview sync
 *  - Middle: featured / bestselling gemstones
 *  - Right: a cinematic promo card driven by the hovered category
 */
export function MegaMenu({ onNavigate }: { onNavigate?: () => void }) {
  const featured = getFeatured(4);
  const { format } = useCurrency();
  const [activeCat, setActiveCat] = useState(categories[0]);

  return (
    <motion.div
      variants={panel}
      initial="hidden"
      animate="show"
      exit="exit"
      className="w-[min(72rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-foreground/10 bg-nebula shadow-[0_40px_120px_-30px_rgba(36,26,59,0.45)]"
    >
      {/* top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_1.35fr_1fr]">
        {/* -------------------------------------------------- *
         * Column 1 — Categories
         * -------------------------------------------------- */}
        <motion.div variants={item} className="border-foreground/10 p-5 lg:border-r">
          <p className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-500">
            <Sparkles size={13} />
            Browse by Category
          </p>
          <ul className="space-y-0.5">
            {categories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/shop?category=${cat.slug}`}
                  onClick={onNavigate}
                  onMouseEnter={() => setActiveCat(cat)}
                  className="group flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.04]"
                >
                  <span>
                    <span className="block text-sm font-medium text-foreground transition-colors group-hover:text-gold-600">
                      {cat.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {cat.tagline}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={16}
                    className="shrink-0 translate-y-0.5 text-foreground/25 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-gold-500 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/shop"
            onClick={onNavigate}
            className="mt-4 inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-gold-600 transition-colors hover:text-gold-500"
          >
            View all gemstones
            <ArrowUpRight size={15} />
          </Link>
        </motion.div>

        {/* -------------------------------------------------- *
         * Column 2 — Featured gemstones
         * -------------------------------------------------- */}
        <motion.div variants={item} className="border-foreground/10 p-5 lg:border-r">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-500">
            <Star size={13} />
            Bestselling Stones
          </p>
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                onClick={onNavigate}
                className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-void transition-all duration-300 hover:border-gold-400/50 hover:shadow-[0_12px_30px_-16px_rgba(36,26,59,0.4)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="200px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {p.badge && (
                    <span className="absolute left-2 top-2 rounded-full bg-gold-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cosmos">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium text-foreground transition-colors group-hover:text-gold-600">
                    {p.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gold-600">
                    {format(p.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* -------------------------------------------------- *
         * Column 3 — Cinematic promo (synced to hovered cat)
         * -------------------------------------------------- */}
        <motion.div variants={item} className="relative p-5">
          <Link
            href={`/shop?category=${activeCat.slug}`}
            onClick={onNavigate}
            className="group relative flex h-full min-h-[16rem] flex-col justify-end overflow-hidden rounded-2xl border border-foreground/10 p-6"
          >
            <motion.div
              key={activeCat.slug}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={activeCat.image}
                alt={activeCat.title}
                fill
                sizes="320px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0" style={{ background: activeCat.tint }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            </motion.div>

            <div className="relative z-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-300">
                Featured Collection
              </p>
              <h4 className="mt-1.5 font-display text-2xl font-semibold text-white">
                {activeCat.title}
              </h4>
              <p className="mt-1 max-w-[16rem] text-xs text-white/70">
                {activeCat.tagline}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors group-hover:bg-gold-400 group-hover:text-cosmos">
                Shop Now
                <ArrowUpRight
                  size={15}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </div>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
