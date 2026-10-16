"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AstroService } from "@/types";
import { SERVICE_ICONS } from "@/modules/services/service.schema";
import { adminApi } from "@/lib/admin-api";
import {
  Modal,
  Field,
  AdminInput,
  AdminTextarea,
  AdminButton,
  AdminDropdown,
  Toggle,
  useAdminToast,
} from "../../_components";

export function ServiceFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: AstroService | null;
  onClose: () => void;
  onSaved: (s: AstroService, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("Sparkles");
  const [priceFrom, setPriceFrom] = useState("");
  const [duration, setDuration] = useState("");
  const [popular, setPopular] = useState(false);
  const [status, setStatus] = useState<string>("active");
  const [features, setFeatures] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setTagline(editing?.tagline ?? "");
    setDescription(editing?.description ?? "");
    setIcon(editing?.icon ?? "Sparkles");
    setPriceFrom(editing ? String(editing.priceFrom) : "");
    setDuration(editing?.duration ?? "");
    setPopular(editing?.popular ?? false);
    setStatus(editing?.status ?? "active");
    setFeatures(editing?.features?.length ? editing.features : [""]);
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    const dto = {
      title,
      tagline,
      description,
      icon: icon as (typeof SERVICE_ICONS)[number],
      priceFrom: Number(priceFrom || 0),
      duration,
      popular,
      status: status as "active" | "inactive",
      features: features.map((f) => f.trim()).filter(Boolean),
    };
    setSaving(true);
    const res = editing
      ? await adminApi.services.update(editing.id, dto)
      : await adminApi.services.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "Service updated" : "Service created", "success");
      onSaved(res.data, !editing);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit service" : "New service"} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kundli Analysis" />
          </Field>
          <Field label="Icon">
            <AdminDropdown
              value={icon}
              options={SERVICE_ICONS.map((i) => ({ value: i, label: i }))}
              onChange={setIcon}
              className="w-full"
            />
          </Field>
        </div>

        <Field label="Tagline">
          <AdminInput value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Your complete birth chart, decoded" />
        </Field>

        <Field label="Description">
          <AdminTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price from (₹)" hint="0 = free">
            <AdminInput type="number" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} placeholder="999" />
          </Field>
          <Field label="Duration">
            <AdminInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45 min" />
          </Field>
        </div>

        {/* features */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Features</span>
            <button
              type="button"
              onClick={() => setFeatures([...features, ""])}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
              style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <AdminInput
                  value={f}
                  onChange={(e) => setFeatures(features.map((x, idx) => (idx === i ? e.target.value : x)))}
                  placeholder="Full birth-chart analysis"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                  aria-label="Remove"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <AdminDropdown
              value={status}
              options={[
                { value: "active", label: "Active (shown)" },
                { value: "inactive", label: "Inactive (hidden)" },
              ]}
              onChange={setStatus}
              className="w-full"
            />
          </Field>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Mark popular</span>
              <Toggle checked={popular} onChange={setPopular} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <AdminButton variant="outline" className="flex-1" onClick={onClose}>Cancel</AdminButton>
          <AdminButton className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}
