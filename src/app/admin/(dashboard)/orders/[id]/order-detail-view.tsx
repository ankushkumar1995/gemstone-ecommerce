"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Send,
  Truck,
  MapPin,
  User,
  ArrowRight,
  RotateCcw,
  Pencil,
} from "lucide-react";
import type { Order, OrderStatus, PaymentStatus } from "@/modules/orders";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  AdminInput,
  Avatar,
  Badge,
  StatusPill,
  Timeline,
  KeyValueList,
  AdminDropdown,
  TableSkeleton,
  EmptyState,
  AdminBreadcrumb,
  useAdminToast,
} from "@/app/admin/_components";
import { OrderStatusStepper } from "../order-status-stepper";
import { STATUS_META, PAYMENT_META, NEXT_STATUSES } from "../order-status";
import { CreateReturnModal } from "./create-return-modal";
import { EditOrderModal } from "./edit-order-modal";

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function OrderDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    const res = await adminApi.orders.get(id);
    if (res.ok) {
      setOrder(res.data);
      setCourier(res.data.fulfillment.courier ?? "");
      setTracking(res.data.fulfillment.trackingNumber ?? "");
      setState("ok");
    } else setState("missing");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !order)
    return <EmptyState title="Order not found" message="This order may have been removed." />;

  const o = order;
  const nexts = NEXT_STATUSES[o.status];

  const changeStatus = async (s: OrderStatus) => {
    const res = await adminApi.orders.updateStatus(o.id, s);
    if (res.ok) {
      setOrder(res.data);
      toast(`Status → ${STATUS_META[s].label}`, "success");
    } else toast(res.message, "error");
  };

  const changePayment = async (p: PaymentStatus) => {
    const res = await adminApi.orders.updatePayment(o.id, p);
    if (res.ok) {
      setOrder(res.data);
      toast(`Payment → ${PAYMENT_META[p].label}`, "success");
    } else toast(res.message, "error");
  };

  const saveTracking = async () => {
    const res = await adminApi.orders.updateFulfillment(o.id, { courier, trackingNumber: tracking });
    if (res.ok) {
      setOrder(res.data);
      toast("Tracking saved", "success");
    } else toast(res.message, "error");
  };

  const submitNote = async () => {
    if (!note.trim()) return;
    const res = await adminApi.orders.addNote(o.id, note.trim());
    if (res.ok) {
      setOrder(res.data);
      setNote("");
      toast("Note added", "success");
    } else toast(res.message, "error");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Orders", href: "/admin/orders" }, { label: o.orderNumber }]} />

      {/* header */}
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/orders")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>{o.orderNumber}</h1>
              <StatusPill tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].label}</StatusPill>
              <StatusPill tone={PAYMENT_META[o.paymentStatus].tone}>{PAYMENT_META[o.paymentStatus].label}</StatusPill>
            </div>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              Placed {new Date(o.placedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nexts.map((s) => (
            <AdminButton
              key={s}
              variant={s === "cancelled" || s === "refunded" ? "outline" : "primary"}
              onClick={() => changeStatus(s)}
            >
              <ArrowRight size={15} /> {STATUS_META[s].label}
            </AdminButton>
          ))}
          {!["delivered", "cancelled", "refunded"].includes(o.status) && (
            <AdminButton variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Edit
            </AdminButton>
          )}
          {(o.status === "shipped" || o.status === "delivered") && (
            <AdminButton variant="outline" onClick={() => setReturnOpen(true)}>
              <RotateCcw size={15} /> Return
            </AdminButton>
          )}
          <AdminButton variant="outline" onClick={() => router.push(`/admin/orders/${o.id}/invoice`)}>
            <Printer size={15} /> Invoice
          </AdminButton>
        </div>
      </div>

      <CreateReturnModal open={returnOpen} order={o} onClose={() => setReturnOpen(false)} />
      <EditOrderModal open={editOpen} order={o} onClose={() => setEditOpen(false)} onSaved={(u) => { setOrder(u); setEditOpen(false); }} />

      {/* stepper */}
      <Card className="mb-6">
        <OrderStatusStepper status={o.status} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* left */}
        <div className="space-y-6">
          {/* items */}
          <Card className="overflow-hidden p-0">
            <h2 className="border-b px-5 py-4 font-semibold" style={{ color: "var(--a-fg)", borderColor: "var(--a-border)" }}>
              Items ({o.items.length})
            </h2>
            <div className="divide-y" style={{ borderColor: "var(--a-border)" }}>
              {o.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt={it.name} className="h-12 w-12 shrink-0 rounded-lg border object-cover" style={{ borderColor: "var(--a-border)" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{it.name}</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                      {it.variantLabel ? `${it.variantLabel} · ` : ""}{it.sku ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm" style={{ color: "var(--a-muted)" }}>
                      {formatPrice(it.unitPrice)} × {it.qty}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{formatPrice(it.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* pricing */}
            <div className="space-y-2 border-t px-5 py-4" style={{ borderColor: "var(--a-border)" }}>
              <Row label="Subtotal" value={formatPrice(o.pricing.subtotal)} />
              {o.pricing.discount > 0 && (
                <Row label={`Discount${o.pricing.couponCode ? ` (${o.pricing.couponCode})` : ""}`} value={`− ${formatPrice(o.pricing.discount)}`} tone="green" />
              )}
              <Row label="Shipping" value={o.pricing.shipping ? formatPrice(o.pricing.shipping) : "Free"} />
              <Row label="Tax" value={formatPrice(o.pricing.tax)} />
              <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--a-border)" }}>
                <span className="font-semibold" style={{ color: "var(--a-fg)" }}>Grand total</span>
                <span className="text-lg font-bold" style={{ color: "var(--a-fg)" }}>{formatPrice(o.pricing.grandTotal)}</span>
              </div>
            </div>
          </Card>

          {/* fulfillment */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Truck size={16} className="text-[var(--a-gold)]" />
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Fulfillment</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier (e.g. BlueDart)" />
              <AdminInput value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" />
            </div>
            <div className="mt-3">
              <AdminButton variant="outline" onClick={saveTracking}>Save tracking</AdminButton>
            </div>
          </Card>

          {/* activity */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Activity</h2>
            <div className="mb-4 flex gap-2">
              <AdminInput value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNote()} placeholder="Add a note…" />
              <AdminButton onClick={submitNote} disabled={!note.trim()}><Send size={15} /></AdminButton>
            </div>
            <Timeline
              items={o.activity.slice(0, 20).map((a) => ({
                title: a.message,
                time: `${timeAgo(a.at)}${a.actor ? ` · ${a.actor}` : ""}`,
                done: a.type === "created" || a.type === "status",
              }))}
            />
          </Card>
        </div>

        {/* right */}
        <div className="space-y-6">
          {/* customer */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <User size={16} className="text-[var(--a-gold)]" />
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Customer</h2>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={o.customer.name} size={40} />
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{o.customer.name}</p>
                <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{o.customer.email}</p>
              </div>
            </div>
            {o.customer.phone && (
              <p className="mt-2 text-sm" style={{ color: "var(--a-muted)" }}>{o.customer.phone}</p>
            )}
            {o.customerId && (
              <AdminButton variant="outline" className="mt-3 w-full" onClick={() => router.push(`/admin/customers/${o.customerId}`)}>
                View profile
              </AdminButton>
            )}
          </Card>

          {/* payment control */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Payment</h2>
            <KeyValueList
              items={[
                { label: "Method", value: <Badge tone="muted">{o.paymentMethod.toUpperCase()}</Badge> },
                { label: "Status", value: <StatusPill tone={PAYMENT_META[o.paymentStatus].tone}>{PAYMENT_META[o.paymentStatus].label}</StatusPill> },
              ]}
            />
            <div className="mt-3">
              <AdminDropdown
                value={o.paymentStatus}
                options={[
                  { value: "unpaid", label: "Mark Unpaid" },
                  { value: "paid", label: "Mark Paid" },
                  { value: "refunded", label: "Mark Refunded" },
                ]}
                onChange={(p) => changePayment(p as PaymentStatus)}
                className="w-full"
              />
            </div>
          </Card>

          {/* shipping address */}
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <MapPin size={16} className="text-[var(--a-gold)]" />
              <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>Shipping address</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>
              <span className="font-medium" style={{ color: "var(--a-fg)" }}>{o.shippingAddress.name}</span><br />
              {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}<br />
              {o.shippingAddress.city}{o.shippingAddress.state ? `, ${o.shippingAddress.state}` : ""} {o.shippingAddress.postalCode}<br />
              {o.shippingAddress.country}
              {o.shippingAddress.phone && <><br />{o.shippingAddress.phone}</>}
            </p>
          </Card>

          {o.notes && (
            <Card>
              <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Order notes</h2>
              <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--a-muted)" }}>{o.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "green" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--a-muted)" }}>{label}</span>
      <span style={{ color: tone === "green" ? "var(--a-fg)" : "var(--a-fg)" }} className={tone === "green" ? "text-emerald-600" : ""}>
        {value}
      </span>
    </div>
  );
}
