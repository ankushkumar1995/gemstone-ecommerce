"use client";

/**
 * Full-page Service editor (create + edit), replaces the old modal.
 *
 * • Same zod schema as the server, so problems show before saving.
 * • Warns before leaving with unsaved changes (browser + in-app links).
 * • Works for old services too: missing fields fall back to safe defaults and
 *   an old / removed category stays as-is until the admin picks another.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, FileText, Image as ImageIcon, IndianRupee, ListChecks, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { AstroService } from "@/types";
import { SERVICE_ICONS, createServiceSchema, type CreateServiceDto } from "@/modules/services/service.schema";
import { adminApi } from "@/lib/admin-api";
import {
  AdminBreadcrumb, AdminButton, AdminDropdown, AdminInput, Card, ConfirmDialog, EmptyState, Field, ImagePickerField,
  RichTextEditor, StatsSkeleton, StatusPill, Toggle, useAdminToast, useOnMount,
} from "../../_components";
import { CatIcon, ServiceCategoryField } from "./service-categories";

type Icon = (typeof SERVICE_ICONS)[number];
type Form = {
  title: string; tagline: string; description: string; icon: Icon; image: string;
  priceFrom: string; duration: string; popular: boolean; status: "active" | "inactive";
  categoryId: string | null; features: string[];
};
type Issue = { field: string; message: string };

const blank = (): Form => ({ title: "", tagline: "", description: "", icon: "Sparkles", image: "", priceFrom: "", duration: "", popular: false, status: "active", categoryId: null, features: [""] });
const toForm = (s: AstroService): Form => ({
  title: s.title ?? "", tagline: s.tagline ?? "", description: s.description ?? "",
  icon: (SERVICE_ICONS as readonly string[]).includes(s.icon) ? (s.icon as Icon) : "Sparkles",
  image: s.image ?? "", priceFrom: String(s.priceFrom ?? 0), duration: s.duration ?? "", popular: Boolean(s.popular),
  status: s.status === "inactive" ? "inactive" : "active", categoryId: s.categoryId ?? null,
  features: s.features?.length ? [...s.features] : [""],
});
/** Comparable snapshot: an emptied rich-text box ("<p></p>") counts as empty. */
const snap = (f: Form) => JSON.stringify({ ...f, description: f.description.replace(/^<p><\/p>$/, ""), features: f.features.map((x) => x.trim()).filter(Boolean) });

const toDto = (f: Form): CreateServiceDto => ({
  title: f.title, tagline: f.tagline, description: f.description.replace(/^<p><\/p>$/, ""), icon: f.icon, image: f.image,
  priceFrom: f.priceFrom.trim() === "" ? 0 : Number(f.priceFrom), duration: f.duration, popular: f.popular, status: f.status,
  features: f.features.map((x) => x.trim()).filter(Boolean), categoryId: f.categoryId,
});

const SECTIONS = [
  { id: "basics", label: "Basics", icon: Sparkles },
  { id: "media", label: "Image", icon: ImageIcon },
  { id: "content", label: "Description", icon: FileText },
  { id: "pricing", label: "Price & duration", icon: IndianRupee },
  { id: "features", label: "Features", icon: ListChecks },
] as const;
const sectionOf = (field: string) =>
  field.startsWith("features") ? "features" : ["priceFrom", "duration"].includes(field) ? "pricing" : field === "description" ? "content" : field === "image" ? "media" : "basics";

function Section({ id, title, subtitle, issues, children, action }: { id: string; title: string; subtitle?: string; issues: Issue[]; children: React.ReactNode; action?: React.ReactNode }) {
  const meta = SECTIONS.find((s) => s.id === id);
  return (
    <Card id={id} className="scroll-mt-24 space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--a-border)" }}>
        <div className="flex items-center gap-3">
          {meta && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(135deg, #e6b43a, #b07fff)" }}>
              <meta.icon size={18} />
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h2>
            {subtitle && <p className="text-xs" style={{ color: "var(--a-muted)" }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {issues.length > 0 && (
        <ul className="space-y-0.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">
          {issues.map((i, k) => <li key={k}>{i.message}</li>)}
        </ul>
      )}
      {children}
    </Card>
  );
}

export function ServiceEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [form, setForm] = useState<Form | null>(id ? null : blank());
  const [saved, setSaved] = useState<string>(id ? "" : snap(blank()));
  const [meta, setMeta] = useState<AstroService | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  // Errors stay hidden until the first Save attempt, so a fresh page isn't red.
  const [tried, setTried] = useState(false);

  useOnMount(async () => {
    if (!id) return;
    const r = await adminApi.services.get(id);
    if (!r.ok) { setMissing(true); return; }
    const f = toForm(r.data);
    setForm(f); setSaved(snap(f)); setMeta(r.data);
  });

  const dirty = form !== null && snap(form) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const clientIssues: Issue[] = useMemo(() => {
    if (!form) return [];
    const out: Issue[] = [];
    if (form.priceFrom.trim() !== "" && !Number.isFinite(Number(form.priceFrom))) out.push({ field: "priceFrom", message: "Price must be a number" });
    const r = createServiceSchema.safeParse(toDto(form));
    if (!r.success) for (const i of r.error.issues) out.push({ field: i.path.join("."), message: `${labelOf(i.path.join("."))}: ${i.message}` });
    return out;
  }, [form]);

  if (missing) return <EmptyState title="Service not found" message="It may have been deleted." />;
  if (!form) return <StatsSkeleton count={3} />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const issuesFor = (section: string) => (tried ? clientIssues.filter((i) => sectionOf(i.field) === section) : []);
  const totalIssues = tried ? clientIssues.length : 0;

  const submit = async () => {
    setTried(true);
    if (clientIssues.length) {
      toast("Fix the highlighted fields first", "error");
      document.getElementById(sectionOf(clientIssues[0].field))?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const dto = toDto(form);
    setSaving(true);
    const r = id ? await adminApi.services.update(id, dto) : await adminApi.services.create(dto);
    setSaving(false);
    if (!r.ok) { toast(r.message, "error"); return; }
    const f = toForm(r.data);
    setForm(f); setSaved(snap(f)); setMeta(r.data);
    toast(id ? "Service updated" : "Service created", "success");
    if (!id) router.replace(`/admin/services/${r.data.id}`);
  };

  const remove = async () => {
    if (!id) return;
    const r = await adminApi.services.remove(id);
    if (r.ok) { toast("Service deleted", "success"); setSaved(snap(form)); router.replace("/admin/services"); } else toast(r.message, "error");
  };

  const checklist = [
    { label: "Title", done: form.title.trim().length >= 2 },
    { label: "Tagline", done: form.tagline.trim().length > 0 },
    { label: "Description", done: form.description.replace(/<[^>]+>/g, "").trim().length > 0 },
    { label: "Price & duration", done: form.priceFrom.trim() !== "" && form.duration.trim() !== "" },
    { label: "At least one feature", done: form.features.some((x) => x.trim()) },
  ];

  return (
    <div className="pb-24">
      <AdminBreadcrumb items={[{ label: "Services", href: "/admin/services" }, { label: id ? form.title || "Untitled" : "New service" }]} />
      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
            {id ? meta?.title || "Untitled service" : "New service"}
            <StatusPill tone={form.status === "active" ? "green" : "muted"}>{form.status === "active" ? "Active" : "Hidden"}</StatusPill>
          </h1>
          {meta?.updatedAt && <p className="text-xs" style={{ color: "var(--a-muted)" }}>Last saved {new Date(meta.updatedAt).toLocaleString("en-IN")}</p>}
        </div>
        {id && meta?.status === "active" && (
          <a href={`/services/${meta.slug}`} target="_blank" rel="noopener noreferrer"><AdminButton variant="outline"><ExternalLink size={15} /> View on site</AdminButton></a>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-6">
          {/* BASICS */}
          <Section id="basics" title="Basics" subtitle="Name, tagline and category" issues={issuesFor("basics")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required hint={`${form.title.length}/80`}>
                <AdminInput value={form.title} onChange={(e) => set("title", e.target.value.slice(0, 80))} placeholder="Kundli Analysis" />
              </Field>
              <Field label="Tagline" hint={`${form.tagline.length}/120 · one line under the title`}>
                <AdminInput value={form.tagline} onChange={(e) => set("tagline", e.target.value.slice(0, 120))} placeholder="Your complete birth chart, decoded" />
              </Field>
              <ServiceCategoryField value={form.categoryId} onChange={(v) => set("categoryId", v)} />
              <Field label="Icon" hint="Used on the card when there is no image">
                <div className="flex items-center gap-2">
                  <CatIcon icon={form.icon} size={36} />
                  <AdminDropdown value={form.icon} options={SERVICE_ICONS.map((i) => ({ value: i, label: i }))} onChange={(v) => set("icon", v as Icon)} className="w-full" />
                </div>
              </Field>
            </div>
            {id && meta && form.title.trim() !== meta.title && (
              <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--a-muted)" }}><AlertTriangle size={13} /> Renaming keeps the same page URL (/services/{meta.slug}), so shared links keep working.</p>
            )}
          </Section>

          {/* MEDIA */}
          <Section id="media" title="Image" subtitle="Shown on the service card. If empty, the icon is used." issues={issuesFor("media")}>
            <div className="max-w-xl">
              <ImagePickerField value={form.image} onChange={(u) => set("image", u)} folder="services" aspect="aspect-[16/9]" />
            </div>
          </Section>

          {/* CONTENT */}
          <Section id="content" title="Description" subtitle="What's covered, who it's for, what to expect" issues={issuesFor("content")}>
            <RichTextEditor value={form.description} onChange={(v) => set("description", v)} placeholder="Describe this service…" />
          </Section>

          {/* PRICING */}
          <Section id="pricing" title="Price & duration" issues={issuesFor("pricing")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price from (₹)" hint="0 = free">
                <AdminInput type="number" min={0} inputMode="numeric" value={form.priceFrom} onChange={(e) => set("priceFrom", e.target.value)} placeholder="999" />
              </Field>
              <Field label="Duration" hint="Empty = 30 min">
                <AdminInput value={form.duration} onChange={(e) => set("duration", e.target.value.slice(0, 40))} placeholder="45 min" />
              </Field>
            </div>
          </Section>

          {/* FEATURES */}
          <Section id="features" title="Features" subtitle="Bullet points on the service card" issues={issuesFor("features")}
            action={<AdminButton variant="outline" disabled={form.features.length >= 20} onClick={() => set("features", [...form.features, ""])}><Plus size={15} /> Add</AdminButton>}>
            <div className="space-y-2">
              {form.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AdminInput value={f} onChange={(e) => set("features", form.features.map((x, k) => (k === i ? e.target.value.slice(0, 160) : x)))} placeholder="Full birth-chart analysis" className="flex-1" aria-label={`Feature ${i + 1}`} />
                  <button type="button" onClick={() => set("features", form.features.length > 1 ? form.features.filter((_, k) => k !== i) : [""])} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10" aria-label={`Remove feature ${i + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {id && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div><p className="text-sm font-semibold text-rose-700">Delete service</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>Removes it from the website. To keep it, set the status to Hidden instead.</p></div>
              <AdminButton variant="danger" onClick={() => setAskDelete(true)}><Trash2 size={15} /> Delete</AdminButton>
            </Card>
          )}
        </div>

        {/* right: publish */}
        <aside className="space-y-4">
          <Card className="sticky top-24 space-y-4 p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Publish</p>
            <ul className="space-y-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2" style={{ color: c.done ? "var(--a-muted)" : "var(--a-fg)" }}>
                  {c.done ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--a-faint)" }} />}
                  {c.label}
                </li>
              ))}
            </ul>
            {totalIssues > 0 && <p className="flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle size={13} /> {totalIssues} field{totalIssues > 1 ? "s" : ""} to fix</p>}
            <Field label="Status">
              <AdminDropdown value={form.status} options={[{ value: "active", label: "Active (shown)" }, { value: "inactive", label: "Hidden" }]} onChange={(v) => set("status", v as Form["status"])} className="w-full" />
            </Field>
            <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Mark popular</span>
              <Toggle checked={form.popular} onChange={(v) => set("popular", v)} />
            </div>
            <AdminButton className="w-full" onClick={submit} disabled={saving || (!dirty && !!id)}>
              <Save size={15} /> {saving ? "Saving…" : id ? "Save changes" : "Create service"}
            </AdminButton>
            {dirty && <p className="text-center text-xs" style={{ color: "var(--a-gold)" }}>Unsaved changes</p>}
          </Card>
        </aside>
      </div>

      <div className="mt-6">
        <Link href="/admin/services" onClick={(e) => { if (dirty) { e.preventDefault(); setLeaveTo("/admin/services"); } }} className="text-sm" style={{ color: "var(--a-muted)" }}>← Back to services</Link>
      </div>

      <ConfirmDialog open={!!leaveTo} onClose={() => setLeaveTo(null)} onConfirm={() => { const to = leaveTo; setSaved(snap(form)); setLeaveTo(null); if (to) router.push(to); }} title="Leave without saving?" message="Your changes on this page will be lost." confirmLabel="Leave" danger />
      <ConfirmDialog open={askDelete} onClose={() => setAskDelete(false)} onConfirm={remove} title="Delete this service?" message={`"${meta?.title ?? form.title}" will be removed from the website. This cannot be undone.`} confirmLabel="Delete" danger />
    </div>
  );
}

function labelOf(field: string) {
  if (field.startsWith("features")) return "Feature";
  return ({ title: "Title", tagline: "Tagline", description: "Description", image: "Image", priceFrom: "Price", duration: "Duration", categoryId: "Category", icon: "Icon" } as Record<string, string>)[field] ?? field;
}
