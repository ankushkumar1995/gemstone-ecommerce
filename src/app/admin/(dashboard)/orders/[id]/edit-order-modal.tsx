"use client";

import { useState } from "react";
import type { Order } from "@/modules/orders";
import { adminApi } from "@/lib/admin-api";
import { Modal, Field, AdminInput, AdminTextarea, AdminButton, useAdminToast } from "@/app/admin/_components";

export function EditOrderModal({
  open,
  order,
  onClose,
  onSaved,
}: {
  open: boolean;
  order: Order;
  onClose: () => void;
  onSaved: (o: Order) => void;
}) {
  const { toast } = useAdminToast();
  const a = order.shippingAddress;
  const [addr, setAddr] = useState({
    name: a.name,
    phone: a.phone ?? "",
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state ?? "",
    postalCode: a.postalCode ?? "",
    country: a.country,
  });
  const [notes, setNotes] = useState(order.notes ?? "");
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof addr) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((prev) => ({ ...prev, [k]: e.target.value }));

  const save = async () => {
    if (!addr.name || !addr.line1 || !addr.city) return toast("Address is incomplete", "error");
    setSaving(true);
    const res = await adminApi.orders.updateDetails(order.id, { shippingAddress: addr, notes });
    setSaving(false);
    if (res.ok) {
      toast("Order updated", "success");
      onSaved(res.data);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit order" subtitle={order.orderNumber} size="lg">
      <div className="space-y-4">
        <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Shipping address</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput value={addr.name} onChange={set("name")} placeholder="Full name" />
          <AdminInput value={addr.phone} onChange={set("phone")} placeholder="Phone" />
          <AdminInput value={addr.line1} onChange={set("line1")} placeholder="Address line 1" />
          <AdminInput value={addr.line2} onChange={set("line2")} placeholder="Line 2 (optional)" />
          <AdminInput value={addr.city} onChange={set("city")} placeholder="City" />
          <AdminInput value={addr.state} onChange={set("state")} placeholder="State" />
          <AdminInput value={addr.postalCode} onChange={set("postalCode")} placeholder="Postal code" />
          <AdminInput value={addr.country} onChange={set("country")} placeholder="Country" />
        </div>
        <Field label="Internal notes">
          <AdminTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>Cancel</AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</AdminButton>
        </div>
      </div>
    </Modal>
  );
}
