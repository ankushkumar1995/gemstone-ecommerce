"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, ShoppingBag, Sparkles } from "lucide-react";
import type { Product } from "@/types";
import { cn, discountPercent } from "@/lib/utils";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { Rating } from "./rating";

export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const discount = discountPercent(product.mrp, product.price);
  const { addToCart, toggleWishlist, isInWishlist } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();
  const wished = isInWishlist(product.id);

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      whileHover={{ y: -8 }}
      className="group relative"
    >
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative overflow-hidden rounded-2xl glass border-gradient transition-all duration-500 group-hover:glow-royal">
          {/* real product image */}
          <div className="relative aspect-square w-full overflow-hidden">
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
            {/* soft tint from the gem's gradient for brand cohesion */}
            <div
              className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
              style={{ background: product.gradient }}
            />

            {/* badge — golden pill, white text (consistent across cards) */}
            {product.badge && (
              <div className="absolute left-3 top-3 z-10">
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
                  {product.badge}
                </span>
              </div>
            )}
            {/* wishlist */}
            <button
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              onClick={(e) => {
                e.preventDefault();
                toggleWishlist(product);
                toast(
                  wished ? "Removed from wishlist" : "Added to wishlist",
                  "wishlist"
                );
              }}
              className={cn(
                "absolute right-3 top-3 z-10 rounded-full bg-white/80 p-2 backdrop-blur-sm transition-colors hover:bg-white",
                wished ? "text-rose-mystic" : "text-muted hover:text-rose-mystic"
              )}
            >
              <Heart size={16} className={cn(wished && "fill-current")} />
            </button>
            {/* discount */}
            {discount > 0 && (
              <span className="absolute bottom-3 right-3 z-10 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
                -{discount}%
              </span>
            )}
          </div>

          {/* info */}
          <div className="relative z-10 space-y-2 p-5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-royal-600">
              <Sparkles size={12} className="text-gold-500" />
              {product.attributes.planet} • {product.attributes.stone.split("(")[0].trim()}
            </div>
            <h3 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600">
              {product.name}
            </h3>
            <Rating value={product.rating} reviews={product.reviews} />

            <div className="flex items-end justify-between pt-2">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {format(product.price)}
                  </span>
                  {discount > 0 && (
                    <span className="text-sm text-muted line-through">
                      {format(product.mrp)}
                    </span>
                  )}
                </div>
                {!product.inStock && (
                  <span className="text-xs text-rose-mystic">Out of stock</span>
                )}
              </div>

              <motion.button
                type="button"
                aria-label="Add to cart"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  if (product.inStock) {
                    addToCart(product);
                    toast(`${product.name} added to cart`);
                  }
                }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-royal-500 to-royal-700 text-white shadow-lg transition-opacity",
                  !product.inStock && "pointer-events-none opacity-40"
                )}
              >
                <ShoppingBag size={16} />
              </motion.button>
            </div>
          </div>

          {/* hover sheen */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gold-300/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </div>
      </Link>
    </motion.div>
  );
}
