"use client";

/**
 * AccountOrders — the customer's "My Orders", DB-backed and rich.
 *
 * Fetches the real orders from /api/v1/account/orders (full Order shape) so we
 * can show everything a shopper expects: a visual progress tracker, the items,
 * the delivery address, a full price breakdown, payment info and courier/
 * tracking details. Premium gemstone-themed design.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Check,
  Loader2,
  MapPin,
  CreditCard,
  Truck,
  Package,
  Sparkles,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { customerApi } from "@/lib/customer-api";
import { shopApi } from "@/lib/shop-api";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import type { Order, OrderStatus } from "@/modules/orders";
import type { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Lucide icons for actions. */
import { RotateCcw, FileText, XCircle, LifeBuoy } from "lucide-react";

/** Storefront-friendly labels for the gemstone journey (packed = "Energising"). */
const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  packed: "Energising",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** The happy-path pipeline shown in the stepper. */
const PIPELINE: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "packed", label: "Energising", icon: Sparkles },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];

const STEP_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 0,
  packed: 1,
  shipped: 2,
  delivered: 3,
  cancelled: -1,
  refunded: -1,
};

export function AccountOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalogue, setCatalogue] = useState<Product[]>([]);

  const loadOrders = async () => {
    const res = await customerApi.orders();
    setOrders(res.ok ? res.data.orders : []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [, prods] = await Promise.all([loadOrders(), shopApi.products.list()]);
      if (!active) return;
      if (prods.ok) setCatalogue(prods.data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">My Orders</h1>
      <p className="mt-1 text-sm text-muted">
        {!loading && orders.length > 0
          ? `${orders.length} order${orders.length !== 1 ? "s" : ""} · your certified gemstones`
          : "Track your gemstone orders here."}
      </p>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-3xl border border-foreground/10 bg-nebula py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading your orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6">
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400/15 to-royal-400/15 text-gold-600">
              <ShoppingBag size={26} />
            </span>
            <p className="mt-4 font-semibold text-foreground">No orders yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              When you order a certified gemstone, it&apos;ll appear here with live status.
            </p>
            <Link href="/shop" className="mt-5">
              <Button variant="gold" size="md">Start Shopping</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} catalogue={catalogue} onChanged={loadOrders} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  catalogue,
  onChanged,
}: {
  order: Order;
  catalogue: Product[];
  onChanged: () => void | Promise<void>;
}) {
  const { format } = useCurrency();
  const { toast } = useToast();
  const { addToCart, openCart } = useCommerce();
  const [busy, setBusy] = useState<"cancel" | "reorder" | null>(null);
  const terminal = order.status === "cancelled" || order.status === "refunded";
  const currentStep = STEP_INDEX[order.status];
  const canCancel = order.status === "pending" || order.status === "confirmed";

  const copyTracking = () => {
    if (order.fulfillment?.trackingNumber) {
      navigator.clipboard?.writeText(order.fulfillment.trackingNumber);
      toast("Tracking number copied", "success");
    }
  };

  // Reorder — add the order's items back to the cart (resolve to live products
  // so prices/stock are current). Skips items no longer available.
  const reorder = () => {
    setBusy("reorder");
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    let added = 0;
    let missing = 0;
    for (const it of order.items) {
      const p = byId.get(it.productId);
      if (p) {
        addToCart(p, it.qty);
        added++;
      } else {
        missing++;
      }
    }
    setBusy(null);
    if (added > 0) {
      toast(
        missing > 0
          ? `Added ${added} item(s). ${missing} no longer available.`
          : "Items added to your cart",
        "success",
      );
      openCart();
    } else {
      toast("These items are no longer available", "error");
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy("cancel");
    const res = await customerApi.cancelOrder(order.id);
    setBusy(null);
    if (res.ok) {
      toast("Order cancelled", "success");
      await onChanged();
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-3xl border border-foreground/10 bg-nebula shadow-[0_14px_40px_-26px_rgba(36,26,59,0.45)]"
    >
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/8 bg-gradient-to-r from-gold-400/[0.05] to-transparent px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400/20 to-royal-400/15 text-gold-600">
            <ShoppingBag size={18} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-wide text-foreground">{order.orderNumber}</p>
            <p className="text-xs text-muted">
              Placed{" "}
              {new Date(order.placedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* progress tracker (hidden for cancelled/refunded) */}
      {!terminal && (
        <div className="px-5 pt-6 sm:px-8">
          <Stepper currentStep={currentStep} />
        </div>
      )}

      {terminal && (
        <div className="mx-5 mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-4 py-3 text-sm text-rose-600 sm:mx-6">
          This order was {order.status}.
          {order.paymentStatus === "refunded" ? " Your refund has been processed." : ""}
        </div>
      )}

      {/* body */}
      <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.5fr_1fr]">
        {/* left: items */}
        <div className="space-y-1">
          <SectionLabel>Items</SectionLabel>
          {order.items.map((it, i) => (
            <div
              key={`${it.productId}-${i}`}
              className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-foreground/10">
                {it.image ? (
                  <Image src={it.image} alt={it.name} fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-foreground/5 text-muted">
                    <Package size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{it.name}</p>
                {it.variantLabel && <p className="text-xs text-muted">{it.variantLabel}</p>}
              </div>
              <span className="rounded-md bg-foreground/5 px-2 py-0.5 text-xs text-muted">×{it.qty}</span>
              <span className="w-20 text-right text-sm font-semibold text-foreground">
                {format(it.lineTotal)}
              </span>
            </div>
          ))}

          {/* tracking */}
          {order.status === "shipped" && order.fulfillment?.trackingNumber && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-aura/25 bg-aura/[0.05] px-4 py-3">
              <Truck size={18} className="shrink-0 text-aura" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {order.fulfillment.courier || "Courier"} · tracking
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {order.fulfillment.trackingNumber}
                </p>
              </div>
              <button
                onClick={copyTracking}
                className="flex items-center gap-1 rounded-lg border border-foreground/15 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          )}
        </div>

        {/* right: address + payment + breakdown */}
        <div className="space-y-5">
          {/* delivery address */}
          <div>
            <SectionLabel>
              <MapPin size={13} /> Delivery address
            </SectionLabel>
            <div className="rounded-2xl border border-foreground/10 bg-void p-3.5 text-sm">
              <p className="font-medium text-foreground">{order.shippingAddress.name}</p>
              <p className="mt-0.5 leading-relaxed text-muted">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""},{" "}
                {order.shippingAddress.city}
                {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ""}
                {order.shippingAddress.postalCode ? ` — ${order.shippingAddress.postalCode}` : ""}
                {order.shippingAddress.phone ? (
                  <>
                    <br />
                    Phone: {order.shippingAddress.phone}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* payment */}
          <div>
            <SectionLabel>
              <CreditCard size={13} /> Payment
            </SectionLabel>
            <div className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-void p-3.5 text-sm">
              <span className="text-foreground">{methodLabel(order.paymentMethod)}</span>
              <PaymentPill status={order.paymentStatus} method={order.paymentMethod} />
            </div>
          </div>

          {/* price breakdown */}
          <div>
            <SectionLabel>Price details</SectionLabel>
            <div className="space-y-2 rounded-2xl border border-foreground/10 bg-void p-3.5 text-sm">
              <Row label="Subtotal" value={format(order.pricing.subtotal)} />
              {order.pricing.discount > 0 && (
                <Row
                  label={`Discount${order.pricing.couponCode ? ` (${order.pricing.couponCode})` : ""}`}
                  value={`− ${format(order.pricing.discount)}`}
                  tone="emerald"
                />
              )}
              <Row
                label="Shipping"
                value={order.pricing.shipping === 0 ? "Free" : format(order.pricing.shipping)}
              />
              {order.pricing.tax > 0 && <Row label="Tax (GST)" value={format(order.pricing.tax)} />}
              <div className="mt-1 flex items-center justify-between border-t border-foreground/10 pt-2.5">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{format(order.pricing.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-foreground/8 bg-void/40 px-5 py-4 sm:px-6">
        <button
          onClick={reorder}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-xl border border-foreground/15 bg-void px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600 disabled:opacity-50"
        >
          <RotateCcw size={14} /> {busy === "reorder" ? "Adding…" : "Buy again"}
        </button>

        <a
          href={`/account/orders/${order.id}/invoice`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-foreground/15 bg-void px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600"
        >
          <FileText size={14} /> Invoice
        </a>

        <a
          href="/contact"
          className="flex items-center gap-1.5 rounded-xl border border-foreground/15 bg-void px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600"
        >
          <LifeBuoy size={14} /> Need help?
        </a>

        {canCancel && (
          <button
            onClick={cancel}
            disabled={busy !== null}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-rose-500/30 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/5 disabled:opacity-50"
          >
            <XCircle size={14} /> {busy === "cancel" ? "Cancelling…" : "Cancel order"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------- small pieces ---------------- */

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center">
      {PIPELINE.map((step, i) => {
        const done = i <= currentStep;
        const isCurrent = i === currentStep;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                  done
                    ? "border-gold-500 bg-gradient-to-br from-gold-400 to-gold-500 text-white"
                    : "border-foreground/15 bg-void text-muted",
                  isCurrent && "ring-4 ring-gold-400/20",
                )}
              >
                {done && !isCurrent ? <Check size={15} /> : <Icon size={15} />}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  done ? "text-foreground" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className="mx-1 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-500 transition-all duration-500",
                    i < currentStep ? "w-full" : "w-0",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const tone: Record<OrderStatus, { pill: string; dot: string }> = {
    pending: { pill: "bg-foreground/8 text-muted", dot: "bg-muted" },
    confirmed: { pill: "bg-royal-400/12 text-royal-600", dot: "bg-royal-500" },
    packed: { pill: "bg-gold-400/15 text-gold-600", dot: "bg-gold-500" },
    shipped: { pill: "bg-aura/15 text-aura", dot: "bg-aura" },
    delivered: { pill: "bg-emerald-500/15 text-emerald-600", dot: "bg-emerald-500" },
    cancelled: { pill: "bg-rose-500/12 text-rose-600", dot: "bg-rose-500" },
    refunded: { pill: "bg-rose-500/12 text-rose-600", dot: "bg-rose-500" },
  };
  const t = tone[status];
  return (
    <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", t.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function PaymentPill({
  status,
  method,
}: {
  status: Order["paymentStatus"];
  method: Order["paymentMethod"];
}) {
  if (status === "paid")
    return <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600">Paid</span>;
  if (status === "refunded")
    return <span className="rounded-full bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-600">Refunded</span>;
  // unpaid
  return (
    <span className="rounded-full bg-gold-400/12 px-2.5 py-1 text-xs font-semibold text-gold-600">
      {method === "cod" ? "Pay on delivery" : "Pending"}
    </span>
  );
}

function methodLabel(m: Order["paymentMethod"]): string {
  switch (m) {
    case "cod":
      return "Cash on Delivery";
    case "razorpay":
      return "Online (Razorpay)";
    case "card":
      return "Card";
    case "upi":
      return "UPI";
    case "netbanking":
      return "Netbanking";
    default:
      return "Manual";
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium", tone === "emerald" ? "text-emerald-600" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}
