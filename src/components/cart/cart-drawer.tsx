"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";

const FREE_SHIP_THRESHOLD = 5000;

/**
 * Slide-over cart. Mounted once at the root; opens whenever an item is added
 * or the navbar cart icon is clicked.
 */
export function CartDrawer() {
  const {
    cart,
    cartOpen,
    closeCart,
    cartSubtotal,
    cartMrpTotal,
    cartCount,
    setQty,
    removeFromCart,
  } = useCommerce();
  const { format } = useCurrency();

  const savings = cartMrpTotal - cartSubtotal;
  const remainingForFreeShip = Math.max(0, FREE_SHIP_THRESHOLD - cartSubtotal);
  const freeShipPct = Math.min(100, (cartSubtotal / FREE_SHIP_THRESHOLD) * 100);

  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
          />

          {/* panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cosmos shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between border-b border-foreground/10 px-6 py-5">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-gold-600" />
                <h2 className="text-lg font-semibold text-foreground">
                  Your Cart
                </h2>
                <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-xs font-medium text-muted">
                  {cartCount}
                </span>
              </div>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            {cart.length === 0 ? (
              <EmptyCart onClose={closeCart} />
            ) : (
              <>
                {/* free shipping progress */}
                <div className="border-b border-foreground/10 px-6 py-4">
                  {remainingForFreeShip > 0 ? (
                    <p className="text-sm text-muted">
                      Add{" "}
                      <span className="font-semibold text-gold-600">
                        {format(remainingForFreeShip)}
                      </span>{" "}
                      more for free insured shipping
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-emerald-600">
                      🎉 You&apos;ve unlocked free insured shipping!
                    </p>
                  )}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${freeShipPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* lines */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <ul className="space-y-4">
                    <AnimatePresence initial={false}>
                      {cart.map((line) => (
                        <motion.li
                          key={line.product.id}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex gap-4"
                        >
                          <Link
                            href={`/product/${line.product.slug}`}
                            onClick={closeCart}
                            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-foreground/10"
                          >
                            <Image
                              src={line.product.image}
                              alt={line.product.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </Link>

                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/product/${line.product.slug}`}
                              onClick={closeCart}
                              className="line-clamp-1 text-sm font-medium text-foreground hover:text-gold-600"
                            >
                              {line.product.name}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">
                              {line.product.attributes.stone}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              {/* qty stepper */}
                              <div className="flex items-center gap-1 rounded-full border border-foreground/15 p-0.5">
                                <button
                                  onClick={() =>
                                    setQty(line.product.id, line.qty - 1)
                                  }
                                  aria-label="Decrease"
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="w-6 text-center text-sm font-medium text-foreground">
                                  {line.qty}
                                </span>
                                <button
                                  onClick={() =>
                                    setQty(line.product.id, line.qty + 1)
                                  }
                                  aria-label="Increase"
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-foreground">
                                {format(line.product.price * line.qty)}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromCart(line.product.id)}
                            aria-label="Remove item"
                            className="self-start text-muted transition-colors hover:text-rose-mystic"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>

                {/* footer */}
                <div className="border-t border-foreground/10 px-6 py-5">
                  {savings > 0 && (
                    <div className="mb-2 flex items-center justify-between text-sm text-emerald-600">
                      <span>You save</span>
                      <span className="font-semibold">{format(savings)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Subtotal</span>
                    <span className="text-xl font-bold text-foreground">
                      {format(cartSubtotal)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Taxes & shipping calculated at checkout.
                  </p>

                  <Link href="/checkout" onClick={closeCart} className="mt-4 block">
                    <Button variant="gold" size="lg" className="w-full">
                      Checkout <ArrowRight size={16} />
                    </Button>
                  </Link>
                  <Link
                    href="/cart"
                    onClick={closeCart}
                    className="mt-2 block text-center text-sm font-medium text-muted transition-colors hover:text-gold-600"
                  >
                    View full cart
                  </Link>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/5 text-muted">
        <ShoppingBag size={32} />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-foreground">
        Your cart is empty
      </h3>
      <p className="mt-1 text-sm text-muted">
        Discover certified gemstones chosen by the stars.
      </p>
      <Link href="/shop" onClick={onClose} className="mt-6">
        <Button variant="gold">Start Shopping</Button>
      </Link>
    </div>
  );
}
