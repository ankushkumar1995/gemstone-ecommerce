"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { Product } from "@/types";
import { Badge, badgeTone } from "@/components/ui/badge";

/**
 * Build a few gallery variants from the single product image using Unsplash
 * crop/zoom params, so every product shows a multi-angle gallery without
 * extra data. Replace with real per-product image arrays later.
 */
function buildImages(src: string): string[] {
  const sep = src.includes("?") ? "&" : "?";
  return [
    src,
    `${src}${sep}crop=entropy&sat=-10`,
    `${src}${sep}crop=faces&fit=crop`,
    `${src}${sep}flip=h`,
  ];
}

export function ProductGallery({ product }: { product: Product }) {
  const images = buildImages(product.image);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ x: 50, y: 50, on: false });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y, on: true });
  };

  return (
    <div className="flex flex-col-reverse gap-4 sm:flex-row">
      {/* thumbnails */}
      <div className="flex gap-3 sm:flex-col">
        {images.map((img, i) => (
          <button
            key={i}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors sm:h-20 sm:w-20 ${
              active === i
                ? "border-gold-400"
                : "border-foreground/10 hover:border-foreground/30"
            }`}
          >
            <Image src={img} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>

      {/* main image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        onMouseMove={handleMove}
        onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
        className="relative aspect-square flex-1 cursor-zoom-in overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_30px_80px_-40px_rgba(36,26,59,0.5)]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <Image
              src={images[active]}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-200"
              style={{
                transform: zoom.on ? "scale(1.6)" : "scale(1)",
                transformOrigin: `${zoom.x}% ${zoom.y}%`,
              }}
            />
          </motion.div>
        </AnimatePresence>

        <div
          className="pointer-events-none absolute inset-0 opacity-15 mix-blend-multiply"
          style={{ background: product.gradient }}
        />

        {product.badge && (
          <div className="pointer-events-none absolute left-6 top-6">
            <Badge tone={badgeTone(product.badge)}>{product.badge}</Badge>
          </div>
        )}
      </motion.div>
    </div>
  );
}
