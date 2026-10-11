"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/modules/orders";
import type { CreateReturnDto } from "@/modules/returns";
import { adminApi } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import {
  Modal,
  Field,
  AdminDropdown,
  AdminTextarea,
  AdminButton,
  Toggle,
  useAdminToast,
} from "@/app/admin/_components";

const REASONS = [
  { value: "damaged", label: "Damaged" },
  { value: "not_as_described", label: "Not as described" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "changed_mind", label: "Changed mind" },
  { value: "quality", label: "Quality issue" },
  { value: "other", label: "Other" },
];

export function CreateReturnModal({
  open,
  order,
  onClose,
}: {
  open: boolean;
  order: Order;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useAdminToast();
  // qty to return per line index
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("damaged");
  const [comment, setComment] = useState("");
  const [restock, setRestock] = useState(true);
  const [saving, setSaving] = useState(false);

  const setQty = (i: number, max: number, v: number) =>
    setQtys((prev) => ({ ...prev, [i]: Math.max(0, Math.min(max, v)) }));

  const selected = order.items
    .map((it, i) => ({ it, i, qty: qtys[i] ?? 0 }))
    .filter((x) => x.qty > 0);

  const total = selected.reduce((s, x) => s + x.it.unitPrice * x.qty, 0);

  const submit = async () => {
    if (selected.length === 0) return toast("Select at least one item to return", "error");
    const dto: CreateReturnDto = {
      orderId: order.id,
      items: selected.map((x) => ({ productId: x.it.productId, variantId: x.it.variantId, qty: x.qty })),
      reason: reason as CreateReturnDto["reason"],
      comment,
      restock,
    };
    setSaving(true);
    const res = await adminApi.returns.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(`Return ${res.data.returnNumber} created`, "success");
      onClose();
      router.push(`/admin/returns/${res.data.id}`);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title="Create return" subtitle={`For ${order.orderNumber}`} size="lg">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>Select items & quantity</p>
          <div className="space-y-2">
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5" style={{ borderColor: "var(--a-border)" }}>
                {it.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-10 w-10 rounded object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>{it.name}</p>
                  <p className="text-xs" style={{ color: "var(--a-faint)" }}>Ordered {it.qty} · {formatPrice(it.unitPrice)}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={it.qty}
                  value={qtys[i] ?? 0}
                  onChange={(e) => setQty(i, it.qty, Number(e.target.value))}
                  className="w-16 rounded-lg border bg-transparent px-2 py-1.5 text-center text-sm outline-none focus:border-[var(--a-gold)]"
                  style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reason">
            <AdminDropdown value={reason} options={REASONS} onChange={setReason} className="w-full" />
          </Field>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Restock on refund</span>
              <Toggle checked={restock} onChange={setRestock} />
            </div>
          </div>
        </div>

        <Field label="Comment">
          <AdminTextarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Reason details…" />
        </Field>

        <div className="flex items-center justify-between rounded-lg px-1">
          <span className="text-sm" style={{ color: "var(--a-muted)" }}>Suggested refund</span>
          <span className="text-lg font-bold" style={{ color: "var(--a-fg)" }}>{formatPrice(total)}</span>
        </div>

        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>Cancel</AdminButton>
          <AdminButton className="flex-1" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create Return"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}
