"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, Sparkles, Star, Gem } from "lucide-react";
import { useCurrency } from "@/lib/currency";
import { cn, discountPercent } from "@/lib/utils";
import type { ShopMenuCategory, ShopMenuData } from "@/lib/shop-menu.types";

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

/** Used when a category has no custom tint set in the admin. */
const DEFAULT_TINT = "linear-gradient(135deg, rgba(145,105,255,0.32), rgba(11,8,32,0.1))";

const shopHref = (slug: string) => `/shop?category=${encodeURIComponent(slug)}`;

/**
 * "Shop All" mega menu, fully driven by the admin (categories + products).
 *  - Left: active top-level categories in admin order (hover syncs the promo)
 *  - Middle: featured products (admin "featured" flag, falls back to others)
 *  - Right: promo card for the hovered category with its sub-categories
 * Any column with no data simply drops out; the panel never shows empty boxes.
 */
export function MegaMenu({
  data,
  onNavigate,
}: {
  data: ShopMenuData;
  onNavigate?: () => void;
}) {
  const { categories, products } = data;
  const { format } = useCurrency();
  const [activeCat, setActiveCat] = useState<ShopMenuCategory | undefined>(categories[0]);

  const hasCats = categories.length > 0;
  const hasProducts = products.length > 0;

  // Nothing in the admin yet: a small, honest panel instead of a broken grid.
  if (!hasCats && !hasProducts) {
    return (
      <motion.div
        variants={panel}
        initial="hidden"
        animate="show"
        exit="exit"
        className="w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-foreground/10 bg-nebula p-6 text-center shadow-[0_40px_120px_-30px_rgba(36,26,59,0.45)]"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600">
          <Gem size={22} />
        </span>
        <p className="mt-3 text-sm text-muted">Our collection is being curated. Explore everything in the shop.</p>
        <Link
          href="/shop"
          onClick={onNavigate}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600 hover:text-gold-500"
        >
          Visit the shop <ArrowUpRight size={15} />
        </Link>
      </motion.div>
    );
  }

  const cols = [hasCats && "1fr", hasProducts && "1.35fr", hasCats && "1fr"].filter(Boolean).join("_");
  const gridCols =
    cols === "1fr_1.35fr_1fr"
      ? "lg:grid-cols-[1fr_1.35fr_1fr]"
      : cols === "1fr_1fr"
        ? "lg:grid-cols-[1fr_1fr]"
        : "lg:grid-cols-1";

  return (
    <motion.div
      variants={panel}
      initial="hidden"
      animate="show"
      exit="exit"
      className={cn(
        "overflow-hidden rounded-3xl border border-foreground/10 bg-nebula shadow-[0_40px_120px_-30px_rgba(36,26,59,0.45)]",
        hasCats && hasProducts ? "w-[min(72rem,calc(100vw-2rem))]" : "w-[min(48rem,calc(100vw-2rem))]"
      )}
    >
      {/* top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

      <div className={cn("grid grid-cols-1 gap-0", gridCols)}>
        {/* -------------------------------------------------- *
         * Column 1 — Categories
         * -------------------------------------------------- */}
        {hasCats && (
          <motion.div variants={item} className="border-foreground/10 p-5 lg:border-r">
            <p className="mb-3 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-500">
              <Sparkles size={13} />
              Browse by Category
            </p>
            <ul className="space-y-0.5">
              {categories.map((cat) => {
                const active = activeCat?.slug === cat.slug;
                return (
                  <li key={cat.slug}>
                    <Link
                      href={shopHref(cat.slug)}
                      onClick={onNavigate}
                      onMouseEnter={() => setActiveCat(cat)}
                      onFocus={() => setActiveCat(cat)}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.04]",
                        active && "bg-foreground/[0.04]"
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "flex items-center gap-2 text-sm font-medium transition-colors group-hover:text-gold-600",
                            active ? "text-gold-600" : "text-foreground"
                          )}
                        >
                          {cat.title}
                          {cat.children.length > 0 && (
                            <span className="rounded-full bg-foreground/[0.06] px-1.5 py-px text-[10px] font-semibold text-muted">
                              {cat.children.length}
                            </span>
                          )}
                        </span>
                        {cat.tagline && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{cat.tagline}</span>
                        )}
                      </span>
                      <ArrowUpRight
                        size={16}
                        className={cn(
                          "shrink-0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-gold-500 group-hover:opacity-100",
                          active ? "translate-y-0 text-gold-500 opacity-100" : "translate-y-0.5 text-foreground/25 opacity-0"
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/shop"
              onClick={onNavigate}
              className="mt-4 inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-gold-600 transition-colors hover:text-gold-500"
            >
              View all products
              <ArrowUpRight size={15} />
            </Link>
          </motion.div>
        )}

        {/* -------------------------------------------------- *
         * Column 2 — Featured products
         * -------------------------------------------------- */}
        {hasProducts && (
          <motion.div variants={item} className={cn("border-foreground/10 p-5", hasCats && "lg:border-r")}>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-500">
              <Star size={13} />
              Bestselling Stones
            </p>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => {
                const off = discountPercent(p.mrp, p.price);
                return (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug}`}
                    onClick={onNavigate}
                    className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-void transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/50 hover:shadow-[0_12px_30px_-16px_rgba(36,26,59,0.4)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="200px"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
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
                      <p className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold text-gold-600">{format(p.price)}</span>
                        {off > 0 && (
                          <>
                            <span className="text-[11px] text-muted line-through">{format(p.mrp)}</span>
                            <span className="text-[11px] font-semibold text-emerald-600">{off}% off</span>
                          </>
                        )}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* -------------------------------------------------- *
         * Column 3 — Promo for the hovered category
         * -------------------------------------------------- */}
        {hasCats && activeCat && (
          <motion.div variants={item} className="relative p-5">
            <div className="group relative flex h-full min-h-[16rem] flex-col justify-end overflow-hidden rounded-2xl border border-foreground/10 p-6">
              <motion.div
                key={activeCat.slug}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={activeCat.image}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0" style={{ background: activeCat.tint || DEFAULT_TINT }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              </motion.div>

              <div className="relative z-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-300">
                  Featured Collection
                </p>
                <h4 className="mt-1.5 font-display text-2xl font-semibold text-white">{activeCat.title}</h4>
                {activeCat.tagline && (
                  <p className="mt-1 max-w-[16rem] text-xs text-white/75">{activeCat.tagline}</p>
                )}

                {/* sub-categories straight from the admin */}
                {activeCat.children.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {activeCat.children.slice(0, 6).map((k) => (
                      <Link
                        key={k.slug}
                        href={shopHref(k.slug)}
                        onClick={onNavigate}
                        className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:border-gold-300 hover:bg-gold-400 hover:text-cosmos"
                      >
                        {k.title}
                      </Link>
                    ))}
                  </div>
                )}

                <Link
                  href={shopHref(activeCat.slug)}
                  onClick={onNavigate}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-gold-400 hover:text-cosmos"
                >
                  Shop Now
                  <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
