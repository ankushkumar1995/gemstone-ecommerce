"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import type { Order } from "@/modules/orders";
import type { StoreSettings } from "@/modules/settings";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import { AdminButton, TableSkeleton, EmptyState } from "@/app/admin/_components";

export function InvoiceView({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    (async () => {
      const [o, s] = await Promise.all([adminApi.orders.get(id), adminApi.settings.get()]);
      if (s.ok) setSettings(s.data);
      if (o.ok) {
        setOrder(o.data);
        setState("ok");
      } else setState("missing");
    })();
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !order)
    return <EmptyState title="Order not found" message="This order may have been removed." />;

  const o = order;
  const store = settings?.general;
  const addr = o.shippingAddress;

  return (
    <div>
      {/* toolbar — hidden when printing */}
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        >
          <ArrowLeft size={18} />
        </button>
        <AdminButton onClick={() => window.print()}>
          <Printer size={16} /> Print / Save PDF
        </AdminButton>
      </div>

      {/* invoice sheet */}
      <div
        className="invoice-sheet mx-auto max-w-3xl rounded-lg border bg-white p-8 text-[#1a1733] shadow-sm print:border-0 print:shadow-none"
        style={{ borderColor: "var(--a-border)" }}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b pb-6" style={{ borderColor: "#eee" }}>
          <div>
            <h1 className="text-2xl font-bold">{store?.storeName ?? "Astrounkle"}</h1>
            {store?.tagline && <p className="mt-1 text-sm text-gray-500">{store.tagline}</p>}
            {store?.address && <p className="mt-2 max-w-xs text-xs text-gray-500">{store.address}</p>}
            {store?.supportEmail && <p className="text-xs text-gray-500">{store.supportEmail}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-gray-400">Invoice</p>
            <p className="mt-1 font-mono text-sm font-semibold">{o.orderNumber}</p>
            <p className="mt-1 text-xs text-gray-500">{new Date(o.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            {settings?.tax.gstin && <p className="mt-1 text-xs text-gray-500">GSTIN: {settings.tax.gstin}</p>}
          </div>
        </div>

        {/* bill to */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bill to</p>
            <p className="mt-2 font-semibold">{o.customer.name}</p>
            <p className="text-sm text-gray-600">{o.customer.email}</p>
            {o.customer.phone && <p className="text-sm text-gray-600">{o.customer.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Ship to</p>
            <p className="mt-2 text-sm text-gray-600">
              {addr.name}<br />
              {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}<br />
              {addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}<br />
              {addr.country}
            </p>
          </div>
        </div>

        {/* items table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y text-left text-xs uppercase tracking-wider text-gray-400" style={{ borderColor: "#eee" }}>
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={i} className="border-b" style={{ borderColor: "#f3f3f3" }}>
                <td className="py-3">
                  <p className="font-medium">{it.name}</p>
                  {(it.variantLabel || it.sku) && (
                    <p className="text-xs text-gray-400">{[it.variantLabel, it.sku].filter(Boolean).join(" · ")}</p>
                  )}
                </td>
                <td className="py-3 text-center">{it.qty}</td>
                <td className="py-3 text-right">{formatPrice(it.unitPrice)}</td>
                <td className="py-3 text-right font-medium">{formatPrice(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatPrice(o.pricing.subtotal)} />
            {o.pricing.discount > 0 && (
              <Row label={`Discount${o.pricing.couponCode ? ` (${o.pricing.couponCode})` : ""}`} value={`− ${formatPrice(o.pricing.discount)}`} />
            )}
            <Row label="Shipping" value={o.pricing.shipping ? formatPrice(o.pricing.shipping) : "Free"} />
            <Row label="Tax" value={formatPrice(o.pricing.tax)} />
            <div className="flex items-center justify-between border-t pt-2 text-base font-bold" style={{ borderColor: "#eee" }}>
              <span>Total</span>
              <span>{formatPrice(o.pricing.grandTotal)}</span>
            </div>
            <p className="pt-1 text-right text-xs text-gray-400">
              {o.paymentMethod.toUpperCase()} · {o.paymentStatus}
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="mt-10 border-t pt-6 text-center text-xs text-gray-400" style={{ borderColor: "#eee" }}>
          Thank you for shopping with {store?.storeName ?? "Astrounkle"}. Every gemstone is certified & energised before dispatch.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
