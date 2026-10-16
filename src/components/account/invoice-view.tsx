"use client";

/**
 * InvoiceView — a clean, print-ready invoice for a single order.
 *
 * Designed for the browser's native "Print → Save as PDF": a Print button
 * (hidden when printing), and print-specific CSS so only the invoice sheet
 * shows. Amounts are in INR (the store's base currency) — invoices are legal
 * documents, so they always use the base currency, not the display currency.
 */

import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import type { Order } from "@/modules/orders";
import type { StoreSettings } from "@/modules/settings";

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  packed: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function InvoiceView({
  order,
  settings,
}: {
  order: Order;
  settings: StoreSettings | null;
}) {
  const storeName = settings?.general.storeName || "Astrounkle";
  const storeAddress = settings?.general.address || "";
  const supportEmail = settings?.general.supportEmail || "";
  const supportPhone = settings?.general.supportPhone || "";
  const gstin = settings?.tax.gstin;

  const a = order.shippingAddress;

  return (
    <div className="min-h-screen bg-void py-8 print:bg-white print:py-0">
      {/* toolbar — hidden in print */}
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between px-5 print:hidden">
        <Link href="/account?tab=orders" className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
          <ArrowLeft size={15} /> Back to orders
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-400 to-gold-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* invoice sheet */}
      <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-[#241a3b] shadow-[0_20px_60px_-30px_rgba(36,26,59,0.4)] print:max-w-none print:shadow-none print:px-6 sm:rounded-2xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-black/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#6d4bd8" }}>
              {storeName}
            </h1>
            {storeAddress && <p className="mt-1 max-w-xs text-xs leading-relaxed text-black/55">{storeAddress}</p>}
            <div className="mt-1 space-y-0.5 text-xs text-black/55">
              {supportEmail && <p>{supportEmail}</p>}
              {supportPhone && <p>{supportPhone}</p>}
              {gstin && <p>GSTIN: {gstin}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-widest text-black/70">Invoice</p>
            <p className="mt-1 text-sm font-semibold">{order.orderNumber}</p>
            <p className="text-xs text-black/55">
              {new Date(order.placedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <span className="mt-2 inline-block rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-black/70">
              {STATUS_LABEL[order.status] ?? order.status} ·{" "}
              {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "refunded" ? "Refunded" : "Unpaid"}
            </span>
          </div>
        </div>

        {/* bill to / ship to */}
        <div className="grid grid-cols-2 gap-6 border-b border-black/10 py-6 text-sm">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-black/45">Billed to</p>
            <p className="font-medium">{order.customer.name}</p>
            <p className="text-black/60">{order.customer.email}</p>
            {order.customer.phone && <p className="text-black/60">{order.customer.phone}</p>}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-black/45">Shipped to</p>
            <p className="font-medium">{a.name}</p>
            <p className="leading-relaxed text-black/60">
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}, {a.city}
              {a.state ? `, ${a.state}` : ""}
              {a.postalCode ? ` — ${a.postalCode}` : ""}
              {a.phone ? <><br />Phone: {a.phone}</> : null}
            </p>
          </div>
        </div>

        {/* items table */}
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-[11px] uppercase tracking-wider text-black/45">
              <th className="pb-2 font-semibold">Item</th>
              <th className="pb-2 text-center font-semibold">Qty</th>
              <th className="pb-2 text-right font-semibold">Unit</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={`${it.productId}-${i}`} className="border-b border-black/[0.06]">
                <td className="py-3">
                  <p className="font-medium">{it.name}</p>
                  {it.variantLabel && <p className="text-xs text-black/50">{it.variantLabel}</p>}
                  {it.sku && <p className="text-xs text-black/40">SKU: {it.sku}</p>}
                </td>
                <td className="py-3 text-center text-black/70">{it.qty}</td>
                <td className="py-3 text-right text-black/70">{inr(it.unitPrice)}</td>
                <td className="py-3 text-right font-medium">{inr(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <Row label="Subtotal" value={inr(order.pricing.subtotal)} />
            {order.pricing.discount > 0 && (
              <Row
                label={`Discount${order.pricing.couponCode ? ` (${order.pricing.couponCode})` : ""}`}
                value={`− ${inr(order.pricing.discount)}`}
              />
            )}
            <Row label="Shipping" value={order.pricing.shipping === 0 ? "Free" : inr(order.pricing.shipping)} />
            {order.pricing.tax > 0 && <Row label="Tax (GST)" value={inr(order.pricing.tax)} />}
            <div className="flex items-center justify-between border-t border-black/15 pt-2.5">
              <span className="font-bold">Total</span>
              <span className="text-lg font-bold" style={{ color: "#6d4bd8" }}>
                {inr(order.pricing.grandTotal)}
              </span>
            </div>
            <p className="pt-1 text-right text-xs text-black/50">
              Payment: {methodLabel(order.paymentMethod)}
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="mt-10 border-t border-black/10 pt-5 text-center text-xs text-black/50">
          <p>Thank you for shopping with {storeName}.</p>
          <p className="mt-0.5">Certified · Energised · Shipped with care.</p>
        </div>
      </div>

      {/* print styling */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 12mm;
          }
          body {
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-black/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
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
