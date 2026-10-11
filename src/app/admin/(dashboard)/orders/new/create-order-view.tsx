"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, Search, User, Package } from "lucide-react";
import type { Product } from "@/types";
import type { Customer } from "@/modules/customers";
import type { CreateOrderDto } from "@/modules/orders";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminDropdown,
  Avatar,
  Field,
  AdminBreadcrumb,
  useAdminToast,
} from "../../../_components";

type LineDraft = { product: Product; variantId?: string; qty: number };

export function CreateOrderView() {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [productQuery, setProductQuery] = useState("");

  // address
  const [addr, setAddr] = useState({
    name: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "India",
  });

  // pricing + meta
  const [discount, setDiscount] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [taxRate, setTaxRate] = useState("3");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    (async () => {
      const [cs, ps] = await Promise.all([adminApi.customers.list(), adminApi.products.list()]);
      if (cs.ok) setCustomers(cs.data);
      if (ps.ok) setProducts(ps.data);
    })();
  }, []);

  // prefill address from selected customer
  useEffect(() => {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    const def = c.addresses.find((a) => a.isDefault) ?? c.addresses[0];
    setAddr((prev) => ({
      ...prev,
      name: c.name,
      phone: c.phone ?? "",
      ...(def && {
        line1: def.line1,
        line2: def.line2 ?? "",
        city: def.city,
        state: def.state ?? "",
        postalCode: def.postalCode ?? "",
        country: def.country,
      }),
    }));
  }, [customerId, customers]);

  const matches = useMemo(() => {
    const t = productQuery.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(t) && !lines.some((l) => l.product.id === p.id))
      .slice(0, 6);
  }, [productQuery, products, lines]);

  const lineUnitPrice = (l: LineDraft) => {
    if (l.variantId) {
      const v = l.product.variants?.find((x) => x.id === l.variantId);
      if (v) return v.price;
    }
    return l.product.price;
  };

  const subtotal = lines.reduce((s, l) => s + lineUnitPrice(l) * l.qty, 0);
  const discountN = Number(discount || 0);
  const shippingN = Number(shipping || 0);
  const taxN = Math.round((Math.max(0, subtotal - discountN) * Number(taxRate || 0)) / 100);
  const grandTotal = Math.max(0, subtotal - discountN) + shippingN + taxN;

  const submit = async () => {
    if (!customerId) return toast("Select a customer", "error");
    if (lines.length === 0) return toast("Add at least one product", "error");
    if (!addr.line1 || !addr.city) return toast("Shipping address is incomplete", "error");

    const dto: CreateOrderDto = {
      customerId,
      items: lines.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty })),
      shippingAddress: addr,
      paymentMethod: paymentMethod as CreateOrderDto["paymentMethod"],
      paymentStatus: paymentStatus as CreateOrderDto["paymentStatus"],
      discount: discountN,
      shipping: shippingN,
      taxRate: Number(taxRate || 0),
      status: status as CreateOrderDto["status"],
    };

    setSaving(true);
    const res = await adminApi.orders.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(`Order ${res.data.orderNumber} created`, "success");
      router.push(`/admin/orders/${res.data.id}`);
    } else toast(res.message, "error");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Orders", href: "/admin/orders" }, { label: "New" }]} />
      <div className="mt-3 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/orders")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>Create Order</h1>
        </div>
        <AdminButton onClick={submit} disabled={saving}>
          <Save size={16} /> {saving ? "Creating…" : "Create Order"}
        </AdminButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* customer */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <User size={16} className="text-[var(--a-gold)]" />
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            </div>
            <AdminDropdown
              value={customerId}
              placeholder="Select a customer"
              options={customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))}
              onChange={setCustomerId}
              className="w-full"
            />
          </Card>

          {/* products */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Package size={16} className="text-[var(--a-gold)]" />
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Items</h2>
            </div>

            {lines.length > 0 && (
              <div className="mb-3 space-y-2">
                {lines.map((l, i) => (
                  <div key={l.product.id} className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: "var(--a-border)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.product.image} alt="" className="h-10 w-10 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{l.product.name}</p>
                      {l.product.variants && l.product.variants.length > 0 && (
                        <div className="mt-1 w-40">
                          <AdminDropdown
                            size="sm"
                            value={l.variantId ?? ""}
                            placeholder="Base"
                            options={[
                              { value: "", label: "Base" },
                              ...l.product.variants.map((v) => ({ value: v.id, label: `${v.label} · ${formatPrice(v.price)}` })),
                            ]}
                            onChange={(vid) => setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, variantId: vid || undefined } : x)))}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))}
                      className="w-16 rounded-lg border bg-transparent px-2 py-1.5 text-center text-sm outline-none focus:border-[var(--a-gold)]"
                      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                    />
                    <span className="w-24 text-right text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
                      {formatPrice(lineUnitPrice(l) * l.qty)}
                    </span>
                    <button
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                      aria-label="Remove"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* product search */}
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--a-muted)" }} />
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search products to add…"
                className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]"
                style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
              />
              {matches.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg" style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}>
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setLines((prev) => [...prev, { product: p, qty: 1 }]);
                        setProductQuery("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-black/[0.04]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="h-8 w-8 rounded object-cover" />
                      <span className="flex-1 truncate text-sm" style={{ color: "var(--a-fg)" }}>{p.name}</span>
                      <span className="text-sm" style={{ color: "var(--a-muted)" }}>{formatPrice(p.price)}</span>
                      <Plus size={14} style={{ color: "var(--a-gold)" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* shipping address */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Shipping address</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} placeholder="Full name" />
              <AdminInput value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="Phone" />
              <AdminInput value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Address line 1" />
              <AdminInput value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} placeholder="Line 2 (optional)" />
              <AdminInput value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="City" />
              <AdminInput value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} placeholder="State" />
              <AdminInput value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} placeholder="Postal code" />
              <AdminInput value={addr.country} onChange={(e) => setAddr({ ...addr, country: e.target.value })} placeholder="Country" />
            </div>
          </Card>
        </div>

        {/* right: summary */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Summary</h2>
            <div className="space-y-3">
              <Field label="Discount (₹)">
                <AdminInput type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Shipping (₹)">
                <AdminInput type="number" value={shipping} onChange={(e) => setShipping(e.target.value)} />
              </Field>
              <Field label="Tax rate (%)">
                <AdminInput type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 space-y-1.5 border-t pt-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
              <SumRow label="Subtotal" value={formatPrice(subtotal)} />
              <SumRow label="Discount" value={`− ${formatPrice(discountN)}`} />
              <SumRow label="Shipping" value={shippingN ? formatPrice(shippingN) : "Free"} />
              <SumRow label="Tax" value={formatPrice(taxN)} />
              <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--a-border)" }}>
                <span className="font-semibold" style={{ color: "var(--a-fg)" }}>Total</span>
                <span className="text-lg font-bold" style={{ color: "var(--a-fg)" }}>{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Payment & status</h2>
            <div className="space-y-3">
              <Field label="Payment method">
                <AdminDropdown value={paymentMethod} options={[
                  { value: "cod", label: "Cash on Delivery" },
                  { value: "card", label: "Card" },
                  { value: "upi", label: "UPI" },
                  { value: "netbanking", label: "Net Banking" },
                  { value: "manual", label: "Manual" },
                ]} onChange={setPaymentMethod} className="w-full" />
              </Field>
              <Field label="Payment status">
                <AdminDropdown value={paymentStatus} options={[
                  { value: "unpaid", label: "Unpaid" },
                  { value: "paid", label: "Paid" },
                ]} onChange={setPaymentStatus} className="w-full" />
              </Field>
              <Field label="Order status" hint="Confirmed+ will decrement stock">
                <AdminDropdown value={status} options={[
                  { value: "pending", label: "Pending" },
                  { value: "confirmed", label: "Confirmed" },
                ]} onChange={setStatus} className="w-full" />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--a-muted)" }}>{label}</span>
      <span style={{ color: "var(--a-fg)" }}>{value}</span>
    </div>
  );
}
