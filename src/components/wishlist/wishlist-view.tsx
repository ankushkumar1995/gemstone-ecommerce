"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { discountPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export function WishlistView() {
  const { wishlist, removeFromWishlist, addToCart } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();

  if (wishlist.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground/5 text-muted">
          <Heart size={40} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
          Your wishlist is empty
        </h1>
        <p className="mt-2 max-w-sm text-muted">
          Tap the heart on any gemstone to save it here for later.
        </p>
        <Link href="/shop" className="mt-8">
          <Button variant="gold" size="lg">
            Discover Gemstones <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Breadcrumb items={[{ label: "Wishlist" }]} className="mb-6" />
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
        My Wishlist
      </h1>
      <p className="mt-1 text-muted">
        {wishlist.length} saved {wishlist.length === 1 ? "gemstone" : "gemstones"}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {wishlist.map((p) => {
            const discount = discountPercent(p.mrp, p.price);
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group overflow-hidden rounded-3xl border border-foreground/10 bg-nebula"
              >
                <Link
                  href={`/product/${p.slug}`}
                  className="relative block aspect-square overflow-hidden"
                >
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {discount > 0 && (
                    <span className="absolute bottom-3 right-3 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-2.5 py-1 text-[11px] font-bold text-white">
                      -{discount}%
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromWishlist(p.id);
                      toast("Removed from wishlist", "wishlist");
                    }}
                    aria-label="Remove from wishlist"
                    className="absolute right-3 top-3 rounded-full bg-white/85 p-2 text-rose-mystic backdrop-blur-sm transition-colors hover:bg-white"
                  >
                    <Trash2 size={15} />
                  </button>
                </Link>

                <div className="p-4">
                  <Link
                    href={`/product/${p.slug}`}
                    className="line-clamp-1 font-medium text-foreground hover:text-gold-600"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-semibold text-foreground">
                      {format(p.price)}
                    </span>
                    {discount > 0 && (
                      <span className="text-xs text-muted line-through">
                        {format(p.mrp)}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="gold"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={!p.inStock}
                    onClick={() => {
                      addToCart(p);
                      toast(`${p.name} added to cart`);
                    }}
                  >
                    <ShoppingBag size={15} />
                    {p.inStock ? "Add to Cart" : "Out of Stock"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
