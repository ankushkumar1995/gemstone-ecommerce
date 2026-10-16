"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Image as ImageIcon, GalleryHorizontalEnd, Link2 } from "lucide-react";
import type { Banner, BannerPlacement } from "@/modules/banners";
import { adminApi } from "@/lib/admin-api";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminTextarea,
  AdminDropdown,
  Field,
  Toggle,
  AdminBreadcrumb,
  ImagePickerField,
  useAdminToast,
} from "../../_components";

const fade = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

/** ISO → datetime-local input value */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BannerFormPage({ editing }: { editing?: Banner | null }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [saving, setSaving] = useState(false);

  const [placement, setPlacement] = useState<string>(editing?.placement ?? "promo");
  const [eyebrow, setEyebrow] = useState(editing?.eyebrow ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? "");
  const [image, setImage] = useState(editing?.image ?? "");
  const [ctaLabel, setCtaLabel] = useState(editing?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(editing?.ctaHref ?? "");
  const [order, setOrder] = useState(editing?.order ? String(editing.order) : "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(editing?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(editing?.endsAt));

  const isEdit = Boolean(editing);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      toast("Title is required", "error");
      return;
    }
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
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
    };
    setSaving(true);
    const res = editing
      ? await adminApi.banners.update(editing.id, dto)
      : await adminApi.banners.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(isEdit ? "Banner updated" : "Banner created", "success");
      setTimeout(() => router.push("/admin/banners"), 150);
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <form onSubmit={submit}>
      <AdminBreadcrumb
        items={[{ label: "Banners", href: "/admin/banners" }, { label: isEdit ? "Edit" : "New" }]}
      />
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/banners")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
              {isEdit ? "Edit Banner" : "Add Banner"}
            </h1>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              {isEdit ? editing?.title : "Create a new storefront banner"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton type="button" variant="outline" onClick={() => router.push("/admin/banners")}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Banner"}
          </AdminButton>
        </div>
      </div>

      <motion.div variants={fade} initial="hidden" animate="show" transition={{ duration: 0.3 }}>
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* main */}
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={GalleryHorizontalEnd} title="Content" />
              <div className="mt-4 space-y-4">
                <Field label="Eyebrow" hint="Small label above the title">
                  <AdminInput value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Stone of the Month" />
                </Field>
                <Field label="Title" required>
                  <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Blue Sapphire — Neelam Festival" />
                </Field>
                <Field label="Subtitle">
                  <AdminTextarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={3} />
                </Field>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={ImageIcon} title="Background image" />
              <div className="mt-4">
                <ImagePickerField value={image} onChange={setImage} folder="banners" />
              </div>
            </Card>

            <Card>
              <SectionTitle icon={Link2} title="Call to action" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="CTA label">
                  <AdminInput value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Shop the Offer" />
                </Field>
                <Field label="CTA link">
                  <AdminInput value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} placeholder="/shop?category=loose-stones" />
                </Field>
              </div>
            </Card>

            {/* live preview */}
            {(image || title) && (
              <Card>
                <SectionTitle icon={GalleryHorizontalEnd} title="Preview" />
                <div
                  className="relative mt-4 aspect-[21/9] overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {image && <img src={image} alt="" className="h-full w-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
                  <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-center p-6 text-white">
                    {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">{eyebrow}</span>}
                    <p className="mt-1 text-2xl font-bold leading-tight">{title || "Banner title"}</p>
                    {subtitle && <p className="mt-1 line-clamp-2 text-sm text-white/80">{subtitle}</p>}
                    {ctaLabel && <span className="mt-3 w-fit rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-black">{ctaLabel}</span>}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* side */}
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={GalleryHorizontalEnd} title="Placement" />
              <div className="mt-4 space-y-4">
                <Field label="Placement" hint="Where it appears on the storefront">
                  <AdminDropdown
                    value={placement}
                    options={[
                      { value: "hero", label: "Hero (large)" },
                      { value: "promo", label: "Promo strip" },
                      { value: "strip", label: "Thin strip" },
                    ]}
                    onChange={setPlacement}
                    className="w-full"
                  />
                </Field>
                <Field label="Display order" hint="Lower shows first within a placement">
                  <AdminInput type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="1" />
                </Field>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={GalleryHorizontalEnd} title="Schedule & visibility" />
              <div className="mt-4 space-y-4">
                <Field label="Starts at" hint="Optional — blank = always">
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
                    style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                  />
                </Field>
                <Field label="Ends at" hint="Optional — blank = never">
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
                    style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Active</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Show on the storefront</p>
                  </div>
                  <Toggle checked={active} onChange={setActive} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </motion.div>

      {/* sticky mobile save bar */}
      <div
        className="sticky bottom-0 mt-6 flex gap-2 border-t py-3 backdrop-blur-xl lg:hidden"
        style={{ borderColor: "var(--a-border)", background: "color-mix(in srgb, var(--a-bg) 85%, transparent)" }}
      >
        <AdminButton type="button" variant="outline" className="flex-1" onClick={() => router.push("/admin/banners")}>
          Cancel
        </AdminButton>
        <AdminButton type="submit" className="flex-1" disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save"}
        </AdminButton>
      </div>
    </form>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
      >
        <Icon size={16} />
      </span>
      <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
        {title}
      </h2>
    </div>
  );
}
