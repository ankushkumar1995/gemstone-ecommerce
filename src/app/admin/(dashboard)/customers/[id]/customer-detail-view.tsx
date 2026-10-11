"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  IndianRupee,
  CalendarClock,
  Send,
} from "lucide-react";
import type { Customer } from "@/modules/customers";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Card,
  AdminButton,
  AdminInput,
  Avatar,
  Badge,
  StatusPill,
  StatCard,
  KeyValueList,
  Timeline,
  CopyButton,
  TableSkeleton,
  EmptyState,
  AdminBreadcrumb,
  useAdminToast,
} from "@/app/admin/_components";
import { CustomerFormModal } from "../customer-form-modal";

function statusTone(s: Customer["status"]): "green" | "gold" | "rose" {
  return s === "vip" ? "gold" : s === "blocked" ? "rose" : "green";
}

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

export function CustomerDetailView({ id, initialEdit = false }: { id: string; initialEdit?: boolean }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const [editOpen, setEditOpen] = useState(initialEdit);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    const res = await adminApi.customers.get(id);
    if (res.ok) {
      setCustomer(res.data);
      setState("ok");
    } else setState("missing");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const res = await adminApi.customers.addNote(id, note.trim());
    setSavingNote(false);
    if (res.ok) {
      setCustomer(res.data);
      setNote("");
      toast("Note added", "success");
    } else toast(res.message, "error");
  };

  if (state === "loading") return <TableSkeleton rows={6} cols={2} />;
  if (state === "missing" || !customer)
    return <EmptyState title="Customer not found" message="This customer may have been deleted." />;

  const c = customer;
  const avgOrder = c.totalOrders > 0 ? Math.round(c.totalSpent / c.totalOrders) : 0;

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Customers", href: "/admin/customers" }, { label: c.name }]} />

      {/* header */}
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/customers")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <Avatar name={c.name} src={c.avatar} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
                {c.name}
              </h1>
              <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill>
            </div>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              Customer since {new Date(c.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <AdminButton onClick={() => setEditOpen(true)}>
          <Pencil size={16} /> Edit
        </AdminButton>
      </div>

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} value={c.totalOrders} label="Total Orders" tone="royal" />
        <StatCard icon={IndianRupee} value={formatPrice(c.totalSpent)} label="Lifetime Value" tone="green" />
        <StatCard icon={IndianRupee} value={formatPrice(avgOrder)} label="Avg Order Value" tone="gold" />
        <StatCard icon={CalendarClock} value={c.lastOrderAt ? timeAgo(c.lastOrderAt) : "—"} label="Last Order" tone="blue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* left */}
        <div className="space-y-6">
          {/* order history (placeholder until orders module exists) */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
              Order history
            </h2>
            <div className="rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--a-border)" }}>
              <ShoppingBag size={24} className="mx-auto mb-2" style={{ color: "var(--a-faint)" }} />
              <p className="text-sm" style={{ color: "var(--a-muted)" }}>
                {c.totalOrders} lifetime orders · {formatPrice(c.totalSpent)} spent
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>
                Full order list appears here once the Orders module is live.
              </p>
            </div>
          </Card>

          {/* addresses */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
              Addresses
            </h2>
            {c.addresses.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--a-faint)" }}>No saved addresses.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {c.addresses.map((a) => (
                  <div key={a.id} className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                    <div className="mb-1 flex items-center gap-2">
                      <MapPin size={14} className="text-[var(--a-gold)]" />
                      <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>{a.label}</span>
                      {a.isDefault && <Badge tone="gold">Default</Badge>}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}<br />
                      {a.city}{a.state ? `, ${a.state}` : ""} {a.postalCode}<br />
                      {a.country}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* activity + add note */}
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
              Activity
            </h2>
            <div className="mb-4 flex gap-2">
              <AdminInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNote()}
                placeholder="Add a note…"
              />
              <AdminButton onClick={submitNote} disabled={savingNote || !note.trim()}>
                <Send size={15} />
              </AdminButton>
            </div>
            {c.activity.length > 0 ? (
              <Timeline
                items={c.activity.slice(0, 15).map((a) => ({
                  title: a.message,
                  time: `${timeAgo(a.at)}${a.actor ? ` · ${a.actor}` : ""}`,
                  done: a.type === "created" || a.type === "order",
                }))}
              />
            ) : (
              <p className="text-sm" style={{ color: "var(--a-faint)" }}>No activity yet.</p>
            )}
          </Card>
        </div>

        {/* right */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
              Contact
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm" style={{ color: "var(--a-muted)" }}>
                  <Mail size={15} /> {c.email}
                </span>
                <CopyButton value={c.email} />
              </div>
              {c.phone && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm" style={{ color: "var(--a-muted)" }}>
                    <Phone size={15} /> {c.phone}
                  </span>
                  <CopyButton value={c.phone} />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>
              Details
            </h2>
            <KeyValueList
              items={[
                { label: "Status", value: <StatusPill tone={statusTone(c.status)}>{c.status}</StatusPill> },
                { label: "Customer ID", value: <code className="text-xs">{c.id}</code> },
                { label: "Joined", value: new Date(c.createdAt).toLocaleDateString() },
                { label: "Orders", value: String(c.totalOrders) },
              ]}
            />
          </Card>

          {c.tags.length > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold" style={{ color: "var(--a-fg)" }}>Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <Badge key={t} tone="royal">{t}</Badge>
                ))}
              </div>
            </Card>
          )}

          {c.notes && (
            <Card>
              <h2 className="mb-2 font-semibold" style={{ color: "var(--a-fg)" }}>Internal notes</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--a-muted)" }}>
                {c.notes}
              </p>
            </Card>
          )}
        </div>
      </div>

      <CustomerFormModal
        open={editOpen}
        editing={c}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setCustomer(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}
