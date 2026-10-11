"use client";

/**
 * CustomerFormModal — create / edit a customer. Reuses shared admin controls
 * (Modal, Field, AdminInput, AdminDropdown, Toggle, ImagePickerField) plus a
 * small inline tags + addresses editor.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import type { Customer, CustomerStatus } from "@/modules/customers";
import { adminApi } from "@/lib/admin-api";
import {
  Modal,
  Field,
  AdminInput,
  AdminTextarea,
  AdminDropdown,
  AdminButton,
  Toggle,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

type AddressDraft = {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

const emptyAddress = (): AddressDraft => ({
  label: "Home",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  isDefault: false,
});

export function CustomerFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing?: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const { toast } = useAdminToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [status, setStatus] = useState<string>("active");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setAvatar(editing?.avatar ?? "");
    setStatus(editing?.status ?? "active");
    setTags(editing?.tags ?? []);
    setNotes(editing?.notes ?? "");
    setAddresses(
      (editing?.addresses ?? []).map((a) => ({
        label: a.label,
        line1: a.line1,
        line2: a.line2 ?? "",
        city: a.city,
        state: a.state ?? "",
        postalCode: a.postalCode ?? "",
        country: a.country,
        isDefault: a.isDefault ?? false,
      }))
    );
    setTagInput("");
  }, [open, editing]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const save = async () => {
    if (!name.trim()) return toast("Name is required", "error");
    if (!email.trim()) return toast("Email is required", "error");

    const dto = {
      name,
      email,
      phone,
      avatar,
      status: status as CustomerStatus,
      tags,
      notes,
      addresses: addresses.map((a) => ({
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      })),
    };

    setSaving(true);
    const res = editing
      ? await adminApi.customers.update(editing.id, dto)
      : await adminApi.customers.create(dto);
    setSaving(false);

    if (res.ok) {
      toast(editing ? "Customer updated" : "Customer created", "success");
      onSaved(res.data);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit customer" : "Add customer"} size="lg">
      <div className="space-y-4">
        {/* avatar + identity */}
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label="Avatar">
            <ImagePickerField value={avatar} onChange={setAvatar} aspect="aspect-square" />
          </Field>
          <div className="space-y-4">
            <Field label="Full name" required>
              <AdminInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ananya Sharma" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" required>
                <AdminInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </Field>
              <Field label="Phone">
                <AdminInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <AdminDropdown
              value={status}
              options={[
                { value: "active", label: "Active" },
                { value: "vip", label: "VIP" },
                { value: "blocked", label: "Blocked" },
              ]}
              onChange={setStatus}
              className="w-full"
            />
          </Field>
          <Field label="Tags">
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {tags.map((t) => (
                  <motion.span
                    key={t}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}
                  >
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                      <X size={11} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <AdminInput
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag + Enter"
              className="mt-2"
            />
          </Field>
        </div>

        <Field label="Internal notes">
          <AdminTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Private notes about this customer…" />
        </Field>

        {/* addresses */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Addresses</span>
            <button
              type="button"
              onClick={() => setAddresses([...addresses, emptyAddress()])}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
              style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}
            >
              <Plus size={12} /> Add address
            </button>
          </div>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {addresses.map((a, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="rounded-lg border p-3"
                  style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
                >
                  <div className="flex items-center gap-2">
                    <AdminInput
                      value={a.label}
                      onChange={(e) => patchAddress(i, { label: e.target.value })}
                      placeholder="Label (Home / Office)"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setAddresses(addresses.filter((_, idx) => idx !== i))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                      aria-label="Remove address"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <AdminInput value={a.line1} onChange={(e) => patchAddress(i, { line1: e.target.value })} placeholder="Address line 1" />
                    <AdminInput value={a.line2} onChange={(e) => patchAddress(i, { line2: e.target.value })} placeholder="Line 2 (optional)" />
                    <AdminInput value={a.city} onChange={(e) => patchAddress(i, { city: e.target.value })} placeholder="City" />
                    <AdminInput value={a.state} onChange={(e) => patchAddress(i, { state: e.target.value })} placeholder="State" />
                    <AdminInput value={a.postalCode} onChange={(e) => patchAddress(i, { postalCode: e.target.value })} placeholder="Postal code" />
                    <AdminInput value={a.country} onChange={(e) => patchAddress(i, { country: e.target.value })} placeholder="Country" />
                  </div>
                  <div className="mt-2">
                    <Toggle
                      checked={a.isDefault}
                      onChange={(v) =>
                        setAddresses(addresses.map((x, idx) => ({ ...x, isDefault: idx === i ? v : v ? false : x.isDefault })))
                      }
                      label="Default address"
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Customer"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );

  function patchAddress(i: number, patch: Partial<AddressDraft>) {
    setAddresses((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
}
