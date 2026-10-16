"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, Loader2, Tag, CreditCard, Banknote, Check } from "lucide-react";
import { useCommerce, type Order } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { shopApi } from "@/lib/shop-api";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { OrderCelebration, SuccessBadge } from "@/components/cart/order-celebration";
import { CheckoutAddressStep, AddressSummary } from "@/components/cart/checkout-address-step";
import { CheckoutOffers } from "@/components/cart/checkout-offers";
import type { CreateOrderDto } from "@/modules/orders";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type PayMethod = "cod" | "online";
type Step = "address" | "payment";

export function CheckoutView() {
  const { cart, cartSubtotal, clearCart, placeOrder, user, authReady, addresses } = useCommerce();
  const { format } = useCurrency();

  const [placed, setPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cod");

  // Two-step flow: pick/confirm the delivery address, then pay.
  const [step, setStep] = useState<Step>("address");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Whether online payment is available (gateway configured on the server).
  const [onlineEnabled, setOnlineEnabled] = useState(false);

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
      // Probe whether the online gateway is configured on the server.
      const cfg = await shopApi.payments.status();
      setOnlineEnabled(cfg.ok ? cfg.data.online : false);
    })();
  }, []);

  // Default the selected address to the saved default (or the first one) once
  // addresses load. Never override an explicit user choice.
  useEffect(() => {
    if (selectedAddressId) return;
    if (addresses.length === 0) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    setSelectedAddressId(def.id);
  }, [addresses, selectedAddressId]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // coupon
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  // Apply a coupon by code. Called by the manual input AND the one-tap
  // "Available offers" list (which passes the code directly).
  const applyCoupon = async (codeArg?: string) => {
    const code = (codeArg ?? couponInput).trim();
    if (!code) return;
    setApplying(true);
    setCouponError("");
    const res = await shopApi.coupons.apply(code, cartSubtotal);
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

  // Build the common order payload. `customerId` is client intent only — the
  // server ALWAYS derives the real customer from the session cookie.
  const buildDto = (
    method: CreateOrderDto["paymentMethod"],
    status: CreateOrderDto["status"],
  ): CreateOrderDto => {
    const a = selectedAddress;
    const name = a?.name || user?.name || "";
    const phone = a?.phone || user?.phone || "";
    return {
      ...(user?.id && { customerId: user.id }),
      customer: { name, email: user?.email ?? "", phone },
      items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
      shippingAddress: {
        name,
        phone,
        line1: a?.line ?? "",
        city: a?.city ?? "",
        state: a?.state ?? "",
        postalCode: a?.pincode ?? "",
        country: "India",
      },
      paymentMethod: method,
      paymentStatus: "unpaid",
      shipping,
      ...(coupon && { couponCode: coupon.code, discount: coupon.discount }),
      status,
    };
  };

  // Finalise a successful order: mirror it into the local store (so /account +
  // /track-order keep working) and show the confirmation screen.
  const finalizeSuccess = (data: {
    orderNumber: string;
    placedAt: string;
    items: { productId: string; name: string; image?: string; unitPrice: number; qty: number }[];
    pricing: { subtotal: number; shipping: number; grandTotal: number };
  }) => {
    const localOrder: Order = {
      id: data.orderNumber,
      date: data.placedAt,
      items: data.items.map((it) => ({
        id: it.productId,
        slug: "",
        name: it.name,
        image: it.image ?? "",
        price: it.unitPrice,
        qty: it.qty,
      })),
      subtotal: data.pricing.subtotal,
      shipping: data.pricing.shipping,
      total: data.pricing.grandTotal,
      status: "Confirmed",
    };
    placeOrder(localOrder);
    clearCart();
    setOrderId(data.orderNumber);
    setPlaced(true);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Safety: never place an order without a delivery address.
    if (!selectedAddress) {
      setStep("address");
      setError("Please choose a delivery address first.");
      return;
    }

    setSubmitting(true);

    if (payMethod === "online") {
      await handleOnlinePayment();
      return;
    }

    // ── Cash on Delivery ── create a confirmed order directly.
    const res = await shopApi.orders.create(buildDto("cod", "confirmed"));
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    finalizeSuccess(res.data);
  };

  // ── Online (Razorpay) ──────────────────────────────────────────────────
  // 1) ask the server to create a PENDING order + a Razorpay order,
  // 2) open Razorpay Checkout,
  // 3) on success, verify the signature server-side → the order is settled.
  const handleOnlinePayment = async () => {
    const init = await shopApi.payments.createRazorpayOrder(buildDto("razorpay", "pending"));
    if (!init.ok) {
      setSubmitting(false);
      setError(init.message);
      return;
    }
    const d = init.data;
    try {
      await openRazorpayCheckout(
        {
          key: d.keyId,
          amount: d.amount,
          currency: d.currency,
          name: "Astrounkle",
          description: `Order ${d.orderNumber}`,
          order_id: d.razorpayOrderId,
          prefill: {
            name: selectedAddress?.name || user?.name || "",
            email: user?.email || "",
            contact: selectedAddress?.phone || user?.phone || "",
          },
          notes: { orderNumber: d.orderNumber },
          theme: { color: "#c9942a" },
        },
        {
          onSuccess: async (r) => {
            const verify = await shopApi.payments.verifyRazorpay({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            setSubmitting(false);
            if (!verify.ok) {
              setError(
                "We received your payment but couldn't confirm it instantly. " +
                  "Don't worry — it'll be reconciled shortly. Ref: " + d.orderNumber,
              );
              return;
            }
            finalizeSuccess(verify.data);
          },
          onDismiss: () => {
            // User closed the modal without paying — the order stays pending.
            setSubmitting(false);
            setError("Payment was cancelled. Your order is saved as pending — you can retry.");
          },
        },
      );
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  if (placed) {
    return (
      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        {/* celebratory confetti burst (one-shot, respects reduced-motion) */}
        <OrderCelebration />

        <SuccessBadge>
          <CheckCircle2 size={38} />
        </SuccessBadge>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mt-6 text-3xl font-semibold text-foreground"
        >
          Order Placed! 🎉
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42, duration: 0.4 }}
          className="mt-1 text-sm text-muted"
        >
          Order ID: <span className="font-semibold text-gold-600">{orderId}</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.52, duration: 0.4 }}
          className="mt-3 max-w-md text-muted"
        >
          Thank you for your order. You&apos;ll receive a confirmation shortly.
          Your gemstone will be certified, energised and shipped with care.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.4 }}
          className="mt-8 flex flex-wrap justify-center gap-3"
        >
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
        </motion.div>
      </div>
    );
  }

  // While the real session is resolving, show a neutral placeholder so the
  // sign-in gate never flashes for an already-logged-in customer on refresh.
  if (!authReady) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="mx-auto h-72 max-w-md animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
      </div>
    );
  }

  // LOGIN REQUIRED — checkout is for signed-in customers only. Send them to the
  // account page and bring them straight back to checkout afterwards.
  if (!user) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-400/12 text-gold-600">
          <Lock size={34} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-foreground">
          Please sign in to checkout
        </h1>
        <p className="mt-2 max-w-sm text-muted">
          For a secure order and to track it later, sign in to your account. New
          here? Creating one takes a few seconds.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account?redirect=/checkout">
            <Button variant="gold" size="lg">
              Sign In <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="/account?redirect=/checkout&tab=signup">
            <Button variant="outline" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
        <Link href="/cart" className="mt-6 text-sm font-medium text-muted hover:text-foreground">
          ← Back to cart
        </Link>
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
        {/* Stepped flow: Address → Payment */}
        <div className="space-y-6">
          {/* ── Step 1: Delivery Address ── */}
          <StepCard
            index={1}
            title="Delivery Address"
            open={step === "address"}
            done={step !== "address" && !!selectedAddress}
            summary={
              selectedAddress ? (
                <AddressSummary
                  address={selectedAddress}
                  onChange={() => setStep("address")}
                />
              ) : null
            }
          >
            <CheckoutAddressStep
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
              onContinue={() => selectedAddress && setStep("payment")}
            />
          </StepCard>

          {/* ── Step 2: Payment ── */}
          <StepCard
            index={2}
            title="Payment Method"
            open={step === "payment"}
            done={false}
            locked={!selectedAddress}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {onlineEnabled && (
                <PayOption
                  active={payMethod === "online"}
                  onClick={() => setPayMethod("online")}
                  icon={CreditCard}
                  title="Pay Online"
                  desc="UPI / Card / Netbanking — secured by Razorpay"
                />
              )}
              <PayOption
                active={payMethod === "cod"}
                onClick={() => setPayMethod("cod")}
                icon={Banknote}
                title="Cash on Delivery"
                desc="Pay in cash when your order arrives"
              />
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Lock size={13} className="text-gold-500" />
              {payMethod === "online"
                ? "You'll complete payment in a secure Razorpay window."
                : "No advance payment needed."}
            </p>
          </StepCard>
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
                    onClick={() => applyCoupon()}
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

              {/* One-tap "Available offers" (public coupons). Hidden once one
                  is applied — the applied chip above covers that state. */}
              {!coupon && (
                <CheckoutOffers
                  cartSubtotal={cartSubtotal}
                  appliedCode={coupon ? (coupon as { code: string }).code : null}
                  onApply={(code) => applyCoupon(code)}
                />
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

            <Button
              variant="gold"
              size="lg"
              type="submit"
              className="mt-5 w-full"
              disabled={submitting || step !== "payment" || !selectedAddress}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {payMethod === "online" ? "Processing…" : "Placing…"}
                </>
              ) : payMethod === "online" ? (
                `Pay ${format(total)}`
              ) : (
                "Place Order"
              )}
            </Button>
            {step !== "payment" && (
              <p className="mt-2 text-center text-xs text-muted">
                Confirm your delivery address to continue
              </p>
            )}

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

/**
 * A single step in the checkout accordion. Shows a numbered badge (or a tick
 * once completed), the title, and either the open body or a compact summary.
 */
function StepCard({
  index,
  title,
  open,
  done,
  locked,
  summary,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  done: boolean;
  locked?: boolean;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border bg-nebula transition-colors",
        open ? "border-gold-400/40" : "border-foreground/10",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3 p-5 sm:p-6">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done
              ? "bg-emerald-500/15 text-emerald-600"
              : open
                ? "bg-gradient-to-br from-gold-400 to-gold-500 text-white"
                : "bg-foreground/8 text-muted",
          )}
        >
          {done ? <Check size={16} /> : index}
        </span>
        <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 sm:px-6">{children}</div>
          </motion.div>
        ) : summary ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pb-5 sm:px-6"
          >
            <div className="rounded-2xl border border-foreground/10 bg-void p-4">{summary}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function PayOption({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
        active
          ? "border-gold-400/70 bg-gold-400/5 ring-2 ring-gold-400/20"
          : "border-foreground/12 bg-void hover:border-gold-400/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-gold-400/15 text-gold-600" : "bg-foreground/5 text-muted",
        )}
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">{desc}</span>
      </span>
    </button>
  );
}
