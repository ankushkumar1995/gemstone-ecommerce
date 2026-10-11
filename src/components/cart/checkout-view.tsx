"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, Loader2, Tag } from "lucide-react";
import { useCommerce, type Order } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { shopApi } from "@/lib/shop-api";
import type { CreateOrderDto } from "@/modules/orders";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export function CheckoutView() {
  const { cart, cartSubtotal, clearCart, placeOrder, user } = useCommerce();
  const { format } = useCurrency();

  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // shipping config comes from store settings (falls back to sensible defaults)
  const [shippingCfg, setShippingCfg] = useState({ freeShippingThreshold: 5000, flatRate: 199 });
  useEffect(() => {
    (async () => {
      const res = await shopApi.settings.get();
      if (res.ok) {
        setShippingCfg({
          freeShippingThreshold: res.data.shipping.freeShippingThreshold,
          flatRate: res.data.shipping.flatRate,
        });
      }
    })();
  }, []);

  // controlled form fields (prefilled from the logged-in user if present)
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // coupon
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setApplying(true);
    setCouponError("");
    const res = await shopApi.coupons.apply(couponInput.trim(), cartSubtotal);
    setApplying(false);
    if (res.ok) {
      setCoupon({ code: res.data.code, discount: res.data.discount });
      setCouponInput("");
    } else {
      setCoupon(null);
      setCouponError(res.message);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponError("");
  };

  const discount = coupon?.discount ?? 0;
  const shipping =
    cartSubtotal >= shippingCfg.freeShippingThreshold || cartSubtotal === 0
      ? 0
      : shippingCfg.flatRate;
  const total = Math.max(0, cartSubtotal - discount) + shipping;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Build the order payload for the real backend. Status "confirmed" so the
    // order commits stock and is immediately actionable in the admin.
    const dto: CreateOrderDto = {
      customer: { name: form.name, email: form.email, phone: form.phone },
      items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
      shippingAddress: {
        name: form.name,
        phone: form.phone,
        line1: form.line1,
        line2: form.landmark,
        city: form.city,
        state: form.state,
        postalCode: form.pincode,
        country: "India",
      },
      paymentMethod: "cod",
      paymentStatus: "unpaid",
      shipping,
      ...(coupon && { couponCode: coupon.code, discount: coupon.discount }),
      status: "confirmed",
    };

    const res = await shopApi.orders.create(dto);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }

    // keep a local copy so /account and /track-order keep working
    const localOrder: Order = {
      id: res.data.orderNumber,
      date: res.data.placedAt,
      items: res.data.items.map((it) => ({
        id: it.productId,
        slug: "",
        name: it.name,
        image: it.image ?? "",
        price: it.unitPrice,
        qty: it.qty,
      })),
      subtotal: res.data.pricing.subtotal,
      shipping: res.data.pricing.shipping,
      total: res.data.pricing.grandTotal,
      status: "Confirmed",
    };
    placeOrder(localOrder);
    clearCart();
    setOrderId(res.data.orderNumber);
    setPlaced(true);
  };

  if (placed) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white"
        >
          <CheckCircle2 size={38} />
        </motion.span>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
          Order Placed!
        </h1>
        <p className="mt-1 text-sm text-muted">
          Order ID: <span className="font-semibold text-gold-600">{orderId}</span>
        </p>
        <p className="mt-3 max-w-md text-muted">
          Thank you for your order. You&apos;ll receive a confirmation shortly.
          Your gemstone will be certified, energised and shipped with care.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account">
            <Button variant="gold" size="lg">
              View My Orders <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="/track-order">
            <Button variant="outline" size="lg">
              Track Order
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="ghost" size="lg">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <h1 className="text-3xl font-semibold text-foreground">
          Nothing to check out
        </h1>
        <p className="mt-2 text-muted">Your cart is empty.</p>
        <Link href="/shop" className="mt-8">
          <Button variant="gold" size="lg">
            Browse Gemstones
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Breadcrumb
        items={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]}
        className="mb-6"
      />
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
        Checkout
      </h1>

      <form
        onSubmit={handlePlaceOrder}
        className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]"
      >
        {/* Form */}
        <div className="space-y-8">
          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <input required placeholder="Full name" className={input} value={form.name} onChange={set("name")} />
              <input required type="tel" placeholder="Phone" className={input} value={form.phone} onChange={set("phone")} />
              <input
                required
                type="email"
                placeholder="Email"
                className={`${input} sm:col-span-2`}
                value={form.email}
                onChange={set("email")}
              />
            </div>
          </Section>

          <Section title="Shipping Address">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                placeholder="Address line"
                className={`${input} sm:col-span-2`}
                value={form.line1}
                onChange={set("line1")}
              />
              <input required placeholder="City" className={input} value={form.city} onChange={set("city")} />
              <input required placeholder="State" className={input} value={form.state} onChange={set("state")} />
              <input required placeholder="PIN code" className={input} value={form.pincode} onChange={set("pincode")} />
              <input placeholder="Landmark (optional)" className={input} value={form.landmark} onChange={set("landmark")} />
            </div>
          </Section>

          <Section title="Payment">
            <div className="rounded-xl border border-foreground/12 bg-void p-4 text-sm text-muted">
              <p className="flex items-center gap-2 text-foreground">
                <Lock size={15} className="text-gold-500" /> Secure payment
              </p>
              <p className="mt-1.5">
                This is a demo checkout — payment is Cash on Delivery. In
                production, a gateway (Razorpay / Stripe) would appear here.
              </p>
            </div>
          </Section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)]">
            <h2 className="text-lg font-semibold text-foreground">
              Order Summary
            </h2>

            <ul className="mt-4 space-y-3">
              {cart.map((l) => (
                <li key={l.product.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-foreground/10">
                    <Image
                      src={l.product.image}
                      alt={l.product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-white">
                      {l.qty}
                    </span>
                  </div>
                  <span className="line-clamp-1 flex-1 text-sm text-foreground">
                    {l.product.name}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {format(l.product.price * l.qty)}
                  </span>
                </li>
              ))}
            </ul>

            {/* coupon */}
            <div className="mt-5 border-t border-foreground/10 pt-5">
              {coupon ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <Tag size={14} className="text-emerald-600" />
                    <span className="font-mono font-semibold text-foreground">{coupon.code}</span>
                    <span className="text-emerald-600">applied</span>
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    placeholder="Coupon code"
                    className={`${input} flex-1 font-mono uppercase`}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={applying || !couponInput.trim()}
                    className="shrink-0 rounded-xl border border-foreground/15 bg-void px-4 text-sm font-semibold text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600 disabled:opacity-50"
                  >
                    {applying ? "…" : "Apply"}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="mt-2 text-xs text-rose-600">{couponError}</p>
              )}
            </div>

            <div className="mt-5 space-y-2 border-t border-foreground/10 pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="font-medium text-foreground">
                  {format(cartSubtotal)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Discount ({coupon?.code})</span>
                  <span className="font-medium text-emerald-600">− {format(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Shipping</span>
                <span className="font-medium text-foreground">
                  {shipping === 0 ? "Free" : format(shipping)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
              <span className="font-medium text-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">
                {format(total)}
              </span>
            </div>

            {error && (
              <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                {error}
              </p>
            )}

            <Button variant="gold" size="lg" type="submit" className="mt-5 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Placing…
                </>
              ) : (
                "Place Order"
              )}
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={13} className="text-gold-500" /> 100% secure &
              certified
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-foreground/10 bg-nebula p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
