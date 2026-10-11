"use client";

import { useEffect, useState } from "react";
import type { Banner, BannerPlacement } from "@/modules/banners";
import { adminApi } from "@/lib/admin-api";
import {
  Modal,
  Field,
  AdminInput,
  AdminTextarea,
  AdminButton,
  AdminDropdown,
  Toggle,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

export function BannerFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Banner | null;
  onClose: () => void;
  onSaved: (b: Banner, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [placement, setPlacement] = useState<string>("promo");
  const [eyebrow, setEyebrow] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaHref, setCtaHref] = useState("");
  const [order, setOrder] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlacement(editing?.placement ?? "promo");
    setEyebrow(editing?.eyebrow ?? "");
    setTitle(editing?.title ?? "");
    setSubtitle(editing?.subtitle ?? "");
    setImage(editing?.image ?? "");
    setCtaLabel(editing?.ctaLabel ?? "");
    setCtaHref(editing?.ctaHref ?? "");
    setOrder(editing?.order ? String(editing.order) : "");
    setActive(editing?.active ?? true);
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    const dto = {
      placement: placement as BannerPlacement,
      eyebrow,
      title,
      subtitle,
      image,
      ctaLabel,
      ctaHref,
      order: order ? Number(order) : undefined,
      active,
    };
    setSaving(true);
    const res = editing
      ? await adminApi.banners.update(editing.id, dto)
      : await adminApi.banners.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(editing ? "Banner updated" : "Banner created", "success");
      onSaved(res.data, !editing);
    } else toast(res.message, "error");
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit banner" : "New banner"} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Placement">
            <AdminDropdown
              value={placement}
              options={[
                { value: "hero", label: "Hero" },
                { value: "promo", label: "Promo strip" },
                { value: "strip", label: "Thin strip" },
              ]}
              onChange={setPlacement}
              className="w-full"
            />
          </Field>
          <Field label="Display order" hint="Lower shows first">
            <AdminInput type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="1" />
          </Field>
        </div>

        <Field label="Eyebrow" hint="Small label above the title">
          <AdminInput value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Stone of the Month" />
        </Field>
        <Field label="Title" required>
          <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blue Sapphire — Neelam Festival" />
        </Field>
        <Field label="Subtitle">
          <AdminTextarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={2} />
        </Field>

        <Field label="Background image">
          <ImagePickerField value={image} onChange={setImage} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CTA label">
            <AdminInput value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Shop the Offer" />
          </Field>
          <Field label="CTA link">
            <AdminInput value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/shop?category=loose-stones" />
          </Field>
        </div>

        {/* live preview */}
        {image && (
          <div className="relative aspect-[21/9] overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-center p-5 text-white">
              {eyebrow && <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">{eyebrow}</span>}
              <p className="mt-1 text-lg font-bold leading-tight">{title || "Banner title"}</p>
              {subtitle && <p className="mt-1 line-clamp-2 text-xs text-white/80">{subtitle}</p>}
              {ctaLabel && <span className="mt-2 w-fit rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black">{ctaLabel}</span>}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Active</p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>Show this banner on the storefront</p>
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
