"use client";

/**
 * PopupFormPage — create/edit a popup. One long form split into cards:
 * Type • Content • CTAs • Design • Targeting • Trigger • Frequency •
 * Schedule & status. Mirrors the banner form conventions (admin UI kit).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  MessageSquare,
  Palette,
  Target,
  Timer,
  Repeat,
  CalendarClock,
  Link2,
  Plus,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import type {
  Popup,
  PopupType,
  PopupCta,
  CreatePopupDto,
} from "@/modules/popups";
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

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PopupFormPage({ editing }: { editing?: Popup | null }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editing);

  // ── basic ──
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<PopupType>(editing?.type ?? "promo");
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [priority, setPriority] = useState(editing?.priority ? String(editing.priority) : "");

  // ── content ──
  const [heading, setHeading] = useState(editing?.content.heading ?? "");
  const [body, setBody] = useState(editing?.content.body ?? "");
  const [image, setImage] = useState(editing?.content.image ?? "");
  const [html, setHtml] = useState(editing?.content.html ?? "");
  const [couponCode, setCouponCode] = useState(editing?.content.couponCode ?? "");
  const [emailPlaceholder, setEmailPlaceholder] = useState(editing?.content.emailPlaceholder ?? "");
  const [submitLabel, setSubmitLabel] = useState(editing?.content.submitLabel ?? "");
  const [successMessage, setSuccessMessage] = useState(editing?.content.successMessage ?? "");
  const [ctas, setCtas] = useState<PopupCta[]>(editing?.content.ctas ?? []);

  // ── design ──
  const d = editing?.design;
  const [layout, setLayout] = useState<string>(d?.layout ?? "center");
  const [corner, setCorner] = useState<string>(d?.corner ?? "bottom-right");
  const [width, setWidth] = useState<string>(d?.width ?? "md");
  const [radius, setRadius] = useState<string>(d?.radius ?? "soft");
  const [imageOnly, setImageOnly] = useState(d?.imageOnly ?? false);
  const [accentColor, setAccentColor] = useState(d?.accentColor ?? "#c9942a");
  const [backgroundColor, setBackgroundColor] = useState(d?.backgroundColor ?? "#ffffff");
  const [textColor, setTextColor] = useState(d?.textColor ?? "#1a1333");
  const [overlay, setOverlay] = useState(d?.overlay ?? true);
  const [showClose, setShowClose] = useState(d?.showClose ?? true);
  const [closeOnOverlayClick, setCloseOnOverlayClick] = useState(d?.closeOnOverlayClick ?? true);
  const [closeOnEsc, setCloseOnEsc] = useState(d?.closeOnEsc ?? true);

  // ── targeting ──
  const tg = editing?.targeting;
  const [pageMode, setPageMode] = useState<string>(tg?.pageMode ?? "all");
  const [pagePaths, setPagePaths] = useState((tg?.pagePaths ?? []).join("\n"));
  const [device, setDevice] = useState<string>(tg?.device ?? "all");
  const [audience, setAudience] = useState<string>(tg?.audience ?? "all");
  const [auth, setAuth] = useState<string>(tg?.auth ?? "all");

  // ── trigger ──
  const tr = editing?.trigger;
  const [triggerType, setTriggerType] = useState<string>(tr?.type ?? "delay");
  const [delaySeconds, setDelaySeconds] = useState(String(tr?.delaySeconds ?? 3));
  const [scrollPercent, setScrollPercent] = useState(String(tr?.scrollPercent ?? 50));

  // ── frequency ──
  const fr = editing?.frequencyRule;
  const [frequency, setFrequency] = useState<string>(fr?.frequency ?? "once-per-session");
  const [everyNDays, setEveryNDays] = useState(String(fr?.everyNDays ?? 7));
  const [cooldownHours, setCooldownHours] = useState(String(fr?.showAgainAfterDismissHours ?? 0));

  // ── schedule ──
  const [startAt, setStartAt] = useState(toLocalInput(editing?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(editing?.endAt));

  const showForm = type === "newsletter" || type === "lead";
  const showImage = type === "promo" || type === "announcement";

  const addCta = () => {
    if (ctas.length >= 2) return;
    setCtas([...ctas, { label: "", href: "", style: "primary" }]);
  };
  const updateCta = (i: number, patch: Partial<PopupCta>) =>
    setCtas((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCta = (i: number) => setCtas((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    const dto: CreatePopupDto = {
      name,
      type,
      enabled,
      priority: priority ? Number(priority) : undefined,
      content: {
        heading,
        body,
        image,
        html,
        couponCode,
        emailPlaceholder,
        submitLabel,
        successMessage,
        ctas: ctas.filter((c) => c.label.trim()),
      },
      design: {
        layout: layout as CreatePopupDto["design"]["layout"],
        corner: corner as CreatePopupDto["design"]["corner"],
        width: width as CreatePopupDto["design"]["width"],
        radius: radius as CreatePopupDto["design"]["radius"],
        imageOnly,
        accentColor,
        backgroundColor,
        textColor,
        overlay,
        showClose,
        closeOnOverlayClick,
        closeOnEsc,
      },
      targeting: {
        pageMode: pageMode as CreatePopupDto["targeting"]["pageMode"],
        pagePaths: pagePaths
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        device: device as CreatePopupDto["targeting"]["device"],
        audience: audience as CreatePopupDto["targeting"]["audience"],
        auth: auth as CreatePopupDto["targeting"]["auth"],
      },
      trigger: {
        type: triggerType as CreatePopupDto["trigger"]["type"],
        delaySeconds: Number(delaySeconds) || 0,
        scrollPercent: Number(scrollPercent) || 0,
      },
      frequencyRule: {
        frequency: frequency as CreatePopupDto["frequencyRule"]["frequency"],
        everyNDays: Number(everyNDays) || 1,
        showAgainAfterDismissHours: Number(cooldownHours) || 0,
      },
      startAt: startAt ? new Date(startAt).toISOString() : "",
      endAt: endAt ? new Date(endAt).toISOString() : "",
    };

    setSaving(true);
    const res = editing
      ? await adminApi.popups.update(editing.id, dto)
      : await adminApi.popups.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(isEdit ? "Popup updated" : "Popup created", "success");
      setTimeout(() => router.push("/admin/popups"), 150);
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <form onSubmit={submit}>
      <AdminBreadcrumb
        items={[{ label: "Popups", href: "/admin/popups" }, { label: isEdit ? "Edit" : "New" }]}
      />
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/popups")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
              {isEdit ? "Edit Popup" : "Add Popup"}
            </h1>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              {isEdit ? editing?.name : "Create a storefront popup"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton type="button" variant="outline" onClick={() => router.push("/admin/popups")}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Popup"}
          </AdminButton>
        </div>
      </div>

      <motion.div variants={fade} initial="hidden" animate="show" transition={{ duration: 0.3 }}>
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* ───────── main column ───────── */}
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={MessageSquare} title="Type & content" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Internal name" required hint="Only you see this">
                    <AdminInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali offer 2026" />
                  </Field>
                  <Field label="Type">
                    <AdminDropdown
                      value={type}
                      options={[
                        { value: "promo", label: "Promo / offer" },
                        { value: "newsletter", label: "Newsletter (email capture)" },
                        { value: "lead", label: "Lead / consultation form" },
                        { value: "announcement", label: "Announcement" },
                        { value: "html", label: "Custom HTML" },
                      ]}
                      onChange={(v) => setType(v as PopupType)}
                      className="w-full"
                    />
                  </Field>
                </div>

                {type === "html" ? (
                  <Field label="Custom HTML" hint="Scripts/styles are stripped on render for safety">
                    <AdminTextarea value={html} onChange={(e) => setHtml(e.target.value)} rows={8} placeholder="<div>…</div>" />
                  </Field>
                ) : (
                  <>
                    <Field label="Heading">
                      <AdminInput value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Get 10% off your first order" />
                    </Field>
                    <Field label="Body text">
                      <AdminTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Join our list and save on your first certified gemstone." />
                    </Field>
                    <Field label="Coupon code" hint="Optional — shown as a highlighted code">
                      <AdminInput value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="NEELAM10" />
                    </Field>
                  </>
                )}

                {showForm && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Email placeholder">
                      <AdminInput value={emailPlaceholder} onChange={(e) => setEmailPlaceholder(e.target.value)} placeholder="you@example.com" />
                    </Field>
                    <Field label="Submit button label">
                      <AdminInput value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} placeholder={type === "lead" ? "Request Callback" : "Subscribe"} />
                    </Field>
                    <Field label="Success message" hint="Shown after submit">
                      <AdminInput value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} placeholder="Thanks! We'll be in touch." />
                    </Field>
                  </div>
                )}
              </div>
            </Card>

            {showImage && (
              <Card>
                <SectionTitle icon={ImageIcon} title="Image" />
                <div className="mt-4">
                  <ImagePickerField value={image} onChange={setImage} folder="popups" />
                </div>
              </Card>
            )}

            {type !== "html" && (
              <Card>
                <SectionTitle icon={Link2} title="Buttons (CTAs)" />
                <div className="mt-4 space-y-3">
                  {ctas.map((c, i) => (
                    <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_8rem_2.5rem]">
                      <Field label={`Button ${i + 1} label`}>
                        <AdminInput value={c.label} onChange={(e) => updateCta(i, { label: e.target.value })} placeholder="Shop now" />
                      </Field>
                      <Field label="Link">
                        <AdminInput value={c.href} onChange={(e) => updateCta(i, { href: e.target.value })} placeholder="/shop" />
                      </Field>
                      <Field label="Style">
                        <AdminDropdown
                          value={c.style}
                          options={[
                            { value: "primary", label: "Primary" },
                            { value: "secondary", label: "Secondary" },
                            { value: "ghost", label: "Ghost" },
                          ]}
                          onChange={(v) => updateCta(i, { style: v as PopupCta["style"] })}
                          className="w-full"
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => removeCta(i)}
                        className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
                        style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
                        aria-label="Remove button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {ctas.length < 2 && (
                    <AdminButton type="button" variant="outline" onClick={addCta}>
                      <Plus size={15} /> Add button
                    </AdminButton>
                  )}
                </div>
              </Card>
            )}

            <Card>
              <SectionTitle icon={Target} title="Targeting" />
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pages">
                    <AdminDropdown
                      value={pageMode}
                      options={[
                        { value: "all", label: "All pages" },
                        { value: "include", label: "Only these paths" },
                        { value: "exclude", label: "All except these paths" },
                      ]}
                      onChange={setPageMode}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Device">
                    <AdminDropdown
                      value={device}
                      options={[
                        { value: "all", label: "All devices" },
                        { value: "desktop", label: "Desktop only" },
                        { value: "mobile", label: "Mobile only" },
                      ]}
                      onChange={setDevice}
                      className="w-full"
                    />
                  </Field>
                </div>
                {pageMode !== "all" && (
                  <Field label="URL paths" hint="One per line. Prefix match; use * for wildcard (e.g. /shop, /product/*)">
                    <AdminTextarea value={pagePaths} onChange={(e) => setPagePaths(e.target.value)} rows={3} placeholder={"/shop\n/product/*"} />
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Audience">
                    <AdminDropdown
                      value={audience}
                      options={[
                        { value: "all", label: "Everyone" },
                        { value: "new", label: "New visitors" },
                        { value: "returning", label: "Returning visitors" },
                      ]}
                      onChange={setAudience}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Login state">
                    <AdminDropdown
                      value={auth}
                      options={[
                        { value: "all", label: "Everyone" },
                        { value: "guest", label: "Guests only" },
                        { value: "customer", label: "Logged-in only" },
                      ]}
                      onChange={setAuth}
                      className="w-full"
                    />
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={Timer} title="Trigger" />
              <div className="mt-4 space-y-4">
                <Field label="Show when" hint="What makes the popup appear">
                  <AdminDropdown
                    value={triggerType}
                    options={[
                      { value: "load", label: "Immediately on load" },
                      { value: "delay", label: "After a delay" },
                      { value: "scroll", label: "After scrolling" },
                      { value: "exit-intent", label: "On exit intent (desktop)" },
                    ]}
                    onChange={setTriggerType}
                    className="w-full"
                  />
                </Field>
                {triggerType === "delay" && (
                  <Field label="Delay (seconds)">
                    <AdminInput type="number" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} />
                  </Field>
                )}
                {triggerType === "scroll" && (
                  <Field label="Scroll depth (%)">
                    <AdminInput type="number" value={scrollPercent} onChange={(e) => setScrollPercent(e.target.value)} />
                  </Field>
                )}
              </div>
            </Card>
          </div>

          {/* ───────── side column ───────── */}
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={CalendarClock} title="Status & priority" />
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Enabled</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Show on the storefront</p>
                  </div>
                  <Toggle checked={enabled} onChange={setEnabled} />
                </div>
                <Field label="Priority" hint="Higher wins when several could show at once">
                  <AdminInput type="number" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="1" />
                </Field>
                <Field label="Starts at" hint="Optional — blank = always">
                  <DateTime value={startAt} onChange={setStartAt} />
                </Field>
                <Field label="Ends at" hint="Optional — blank = never">
                  <DateTime value={endAt} onChange={setEndAt} />
                </Field>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={Repeat} title="Frequency" />
              <div className="mt-4 space-y-4">
                <Field label="How often per visitor">
                  <AdminDropdown
                    value={frequency}
                    options={[
                      { value: "every-visit", label: "Every visit" },
                      { value: "once-per-session", label: "Once per session" },
                      { value: "once-per-day", label: "Once per day" },
                      { value: "once-per-n-days", label: "Once per N days" },
                      { value: "once-ever", label: "Once ever" },
                    ]}
                    onChange={setFrequency}
                    className="w-full"
                  />
                </Field>
                {frequency === "once-per-n-days" && (
                  <Field label="N days">
                    <AdminInput type="number" value={everyNDays} onChange={(e) => setEveryNDays(e.target.value)} />
                  </Field>
                )}
                <Field label="Cooldown after dismiss (hours)" hint="0 = just use the frequency above">
                  <AdminInput type="number" value={cooldownHours} onChange={(e) => setCooldownHours(e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card>
              <SectionTitle icon={Palette} title="Design" />
              <div className="mt-4 space-y-4">
                <Field label="Layout">
                  <AdminDropdown
                    value={layout}
                    options={[
                      { value: "center", label: "Center modal" },
                      { value: "corner", label: "Corner slide-in" },
                      { value: "top-bar", label: "Top bar" },
                      { value: "bottom-bar", label: "Bottom bar" },
                      { value: "fullscreen", label: "Fullscreen" },
                    ]}
                    onChange={setLayout}
                    className="w-full"
                  />
                </Field>
                {layout === "corner" && (
                  <Field label="Corner">
                    <AdminDropdown
                      value={corner}
                      options={[
                        { value: "bottom-right", label: "Bottom right" },
                        { value: "bottom-left", label: "Bottom left" },
                        { value: "top-right", label: "Top right" },
                        { value: "top-left", label: "Top left" },
                      ]}
                      onChange={setCorner}
                      className="w-full"
                    />
                  </Field>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Width">
                    <AdminDropdown
                      value={width}
                      options={[
                        { value: "sm", label: "Small" },
                        { value: "md", label: "Medium" },
                        { value: "lg", label: "Large" },
                      ]}
                      onChange={setWidth}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Corners">
                    <AdminDropdown
                      value={radius}
                      options={[
                        { value: "none", label: "Square" },
                        { value: "soft", label: "Soft" },
                        { value: "round", label: "Round" },
                      ]}
                      onChange={setRadius}
                      className="w-full"
                    />
                  </Field>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <Toggle checked={imageOnly} onChange={setImageOnly} label="Image-only popup" />
                  <p className="mt-1.5 text-xs" style={{ color: "var(--a-faint)" }}>
                    Show only the image — no text, heading or code area. If a first
                    button link is set, clicking the image follows it.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
                  <ColorField label="Background" value={backgroundColor} onChange={setBackgroundColor} />
                  <ColorField label="Text" value={textColor} onChange={setTextColor} />
                </div>
                <div className="space-y-2.5 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <Toggle checked={overlay} onChange={setOverlay} label="Dim background overlay" />
                  <Toggle checked={showClose} onChange={setShowClose} label="Show close button" />
                  <Toggle checked={closeOnOverlayClick} onChange={setCloseOnOverlayClick} label="Close on overlay click" />
                  <Toggle checked={closeOnEsc} onChange={setCloseOnEsc} label="Close on Esc key" />
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
        <AdminButton type="button" variant="outline" className="flex-1" onClick={() => router.push("/admin/popups")}>
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

function DateTime({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--a-gold)]"
      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
    />
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--a-border)" }}>
        <input
          type="color"
          value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={`${label} color`}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: "var(--a-fg)" }}
        />
      </div>
    </Field>
  );
}
