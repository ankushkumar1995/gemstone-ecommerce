"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ShieldCheck,
  Truck,
  ArrowRight,
  Tag,
} from "lucide-react";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export function CartView() {
  const {
    cart,
    cartCount,
    cartSubtotal,
    cartMrpTotal,
    setQty,
    removeFromCart,
  } = useCommerce();
  const { format } = useCurrency();

  const savings = cartMrpTotal - cartSubtotal;
  const shipping = cartSubtotal >= 5000 || cartSubtotal === 0 ? 0 : 199;
  const total = cartSubtotal + shipping;

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-foreground/5 text-muted">
          <ShoppingBag size={40} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
          Your cart is empty
        </h1>
        <p className="mt-2 max-w-sm text-muted">
          Looks like you haven&apos;t added any gemstones yet. Let the stars
          guide your next find.
        </p>
        <Link href="/shop" className="mt-8">
          <Button variant="gold" size="lg">
            Explore Gemstones <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Breadcrumb items={[{ label: "Cart" }]} className="mb-6" />
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
        Shopping Cart
      </h1>
      <p className="mt-1 text-muted">
        {cartCount} {cartCount === 1 ? "item" : "items"} in your cart
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Lines */}
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {cart.map((line) => (
              <motion.div
                key={line.product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, scale: 0.97 }}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="group flex gap-4 rounded-3xl border border-foreground/10 bg-nebula p-4 transition-all duration-500 hover:border-gold-400/40 hover:shadow-[0_24px_55px_-30px_rgba(201,148,42,0.5)] sm:p-5"
              >
                <Link
                  href={`/product/${line.product.slug}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 sm:h-28 sm:w-28"
                >
                  <Image
                    src={line.product.image}
                    alt={line.product.name}
                    fill
                    sizes="(max-width: 640px) 80px, 112px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${line.product.slug}`}
                        className="line-clamp-2 font-medium text-foreground hover:text-gold-600 sm:line-clamp-1"
                      >
                        {line.product.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-muted">
                        {line.product.attributes.planet} •{" "}
                        {line.product.attributes.stone}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.15, rotate: -8 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFromCart(line.product.id)}
                      aria-label="Remove"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-rose-mystic/10 hover:text-rose-mystic"
                    >
                      <Trash2 size={17} />
                    </motion.button>
                  </div>

                  <div className="mt-auto flex flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between">
                    {/* qty */}
                    <div className="flex w-fit items-center gap-1 rounded-full border border-foreground/15 p-1 transition-colors group-hover:border-gold-400/40">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setQty(line.product.id, line.qty - 1)}
                        aria-label="Decrease"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-gold-400/15 hover:text-gold-600"
                      >
                        <Minus size={14} />
                      </motion.button>
                      <motion.span
                        key={line.qty}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="w-8 text-center text-sm font-semibold text-foreground"
                      >
                        {line.qty}
                      </motion.span>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setQty(line.product.id, line.qty + 1)}
                        aria-label="Increase"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-gold-400/15 hover:text-gold-600"
                      >
                        <Plus size={14} />
                      </motion.button>
                    </div>

                    <div className="flex items-baseline gap-2 sm:block sm:text-right">
                      <motion.p
                        key={line.product.price * line.qty}
                        initial={{ y: -6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="font-semibold text-foreground transition-colors group-hover:text-gold-600"
                      >
                        {format(line.product.price * line.qty)}
                      </motion.p>
                      {line.product.mrp > line.product.price && (
                        <p className="text-xs text-muted line-through">
                          {format(line.product.mrp * line.qty)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:text-gold-500"
          >
            ← Continue shopping
          </Link>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)]">
            <h2 className="text-lg font-semibold text-foreground">
              Order Summary
            </h2>

            <div className="mt-5 space-y-3 text-sm">
              <Row label={`Subtotal (${cartCount} items)`} value={format(cartSubtotal)} />
              {savings > 0 && (
                <Row
                  label="Discount"
                  value={`− ${format(savings)}`}
                  accent="emerald"
                />
              )}
              <Row
                label="Shipping"
                value={shipping === 0 ? "Free" : format(shipping)}
                accent={shipping === 0 ? "emerald" : undefined}
              />
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-foreground/10 pt-5">
              <span className="font-medium text-foreground">Total</span>
              <span className="text-2xl font-bold text-foreground">
                {format(total)}
              </span>
            </div>

            {/* coupon */}
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-foreground/20 bg-void px-3 py-2.5">
              <Tag size={16} className="text-gold-500" />
              <input
                placeholder="Coupon code"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              <button className="shrink-0 text-sm font-semibold text-gold-600 hover:text-gold-500">
                Apply
              </button>
            </div>

            <Link href="/checkout" className="mt-5 block">
              <Button variant="gold" size="lg" className="w-full">
                Proceed to Checkout <ArrowRight size={16} />
              </Button>
            </Link>

            <div className="mt-5 space-y-2 text-xs text-muted">
              <p className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-gold-500" /> Lab-certified
                authentic gemstones
              </p>
              <p className="flex items-center gap-2">
                <Truck size={14} className="text-gold-500" /> Free insured
                shipping over ₹5,000
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span
        className={
          accent === "emerald"
            ? "font-medium text-emerald-600"
            : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
