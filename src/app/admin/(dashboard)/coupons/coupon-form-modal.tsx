"use client";

import { useEffect, useState } from "react";
import type { Coupon, CouponType } from "@/modules/coupons";
import { adminApi } from "@/lib/admin-api";
import {
  Modal,
  Field,
  AdminInput,
  AdminButton,
  AdminDropdown,
  Toggle,
  SegmentedControl,
  useAdminToast,
} from "../../_components";

/** ISO → datetime-local input value */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CouponFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Coupon | null;
  onClose: () => void;
  onSaved: (c: Coupon, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState("");
  const [minCartValue, setMinCartValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setDescription(editing?.description ?? "");
    setType(editing?.type ?? "percentage");
    setValue(editing ? String(editing.value) : "");
    setMinCartValue(editing?.minCartValue ? String(editing.minCartValue) : "");
    setMaxDiscount(editing?.maxDiscount ? String(editing.maxDiscount) : "");
    setUsageLimit(editing?.usageLimit ? String(editing.usageLimit) : "");
    setStartsAt(toLocalInput(editing?.startsAt));
    setExpiresAt(toLocalInput(editing?.expiresAt));
    setActive(editing?.active ?? true);
  }, [open, editing]);

  const save = async () => {
    if (!code.trim()) return toast("Code is required", "error");
    const v = Number(value || 0);
    if (v <= 0) return toast("Enter a discount value", "error");
    if (type === "percentage" && v > 100) return toast("Percentage can't exceed 100", "error");

    const dto = {
      code,
      description,
      type,
      value: v,
      minCartValue: Number(minCartValue || 0),
      maxDiscount: Number(maxDiscount || 0),
      usageLimit: Number(usageLimit || 0),
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "",
      active,
    };

    setSaving(true);
    const res = editing
      ? await adminApi.coupons.update(editing.id, dto)
      : await adminApi.coupons.create(dto);
    setSaving(false);

    if (res.ok) {
      toast(editing ? "Coupon updated" : "Coupon created", "success");
      onSaved(res.data, !editing);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit coupon" : "New coupon"} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" required>
            <AdminInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SAVE10"
              className="font-mono uppercase"
            />
          </Field>
          <Field label="Type">
            <SegmentedControl
              value={type}
              onChange={(v) => setType(v as CouponType)}
              options={[
                { value: "percentage", label: "Percentage" },
                { value: "fixed", label: "Fixed ₹" },
              ]}
            />
          </Field>
        </div>

        <Field label="Description">
          <AdminInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="10% off your first order" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={type === "percentage" ? "Discount (%)" : "Discount (₹)"} required>
            <AdminInput type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "percentage" ? "10" : "500"} />
          </Field>
          {type === "percentage" && (
            <Field label="Max discount (₹)" hint="Cap for % coupons (0 = no cap)">
              <AdminInput type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="3000" />
            </Field>
          )}
          <Field label="Minimum cart (₹)" hint="0 = no minimum">
            <AdminInput type="number" value={minCartValue} onChange={(e) => setMinCartValue(e.target.value)} placeholder="2000" />
          </Field>
          <Field label="Usage limit" hint="0 = unlimited">
            <AdminInput type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="100" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts at">
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
              style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
            />
          </Field>
          <Field label="Expires at">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
              style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Active</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Customers can apply this coupon</p>
          </div>
          <Toggle checked={active} onChange={setActive} />
        </div>

        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}
