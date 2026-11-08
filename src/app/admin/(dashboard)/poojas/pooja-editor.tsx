"use client";

/**
 * Full-page Pooja editor (create + edit). Sections: Basics, Location,
 * Content, Media, Packages, Add-ons, Schedule, Sankalp form, Policy, SEO.
 *
 * • Validates on the client with the same zod schema the server uses, and
 *   shows every problem next to its section before saving.
 * • "Publish" also runs the publish checklist (cover, packages, schedule…).
 * • Warns before leaving with unsaved changes (browser + in-app links).
 * • Live preview of the next slots for the current schedule.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowDown, ArrowUp, CalendarDays, Check, CheckCircle2, Circle, Copy, ExternalLink, FileText, Flame, Image as ImageIcon, MapPin, Package,
  Plus, PlusCircle, Save, ScrollText, Search, Send, ShieldCheck, Sparkles, Star, Trash2,
} from "lucide-react";
import { poojaAdminApi } from "@/lib/admin-pooja-api";
import { poojaInputSchema, type PoojaInput } from "@/modules/poojas/pooja.schema";
import { blankPolicy, blankSankalp, blankSchedule, buildSlots, isDate, publishIssues } from "@/modules/poojas/pooja.rules";
import {
  ADDON_KINDS, ADDON_LABEL, LOCATION_LABEL, LOCATION_MODES, PACKAGE_KINDS, PACKAGE_LABEL,
  type Pooja, type PoojaAddOn, type PoojaPackage,
} from "@/modules/poojas/pooja.types";
import {
  AdminBreadcrumb, AdminButton, AdminInput, AdminSelectPro, AdminTextarea, Badge, Card, ConfirmDialog, EmptyState, Field, ImagePickerField,
  StatsSkeleton, StatusPill, Toggle, useAdminToast, useOnMount,
} from "../../_components";
import { POOJA_STATUS, WEEKDAYS, fmtSlot, inr, shortId } from "./pooja-meta";
import { CategoryField } from "./pooja-categories";
import { HAVAN_DELIVERABLES_DEFAULT, HAVAN_SAMAGRI_DEFAULT, HavanFields, TierFields, TypeChooser } from "./havan-fields";
import { blankHavan } from "@/modules/poojas/pooja.types";

type Form = PoojaInput;
type Issue = { field: string; message: string };

const SECTIONS = [
  { id: "basics", label: "Basics", hint: "Name, deity, category", icon: Sparkles },
  { id: "location", label: "Location & ritual", hint: "Temple, duration, pandits", icon: MapPin },
  { id: "havan", label: "Havan & anushthan", hint: "Ekal / samuhik, days, samagri", icon: Flame, havanOnly: true },
  { id: "content", label: "Content", hint: "Description, benefits, vidhi", icon: FileText },
  { id: "media", label: "Images & video", hint: "Cover and gallery", icon: ImageIcon },
  { id: "packages", label: "Packages", hint: "Individual, family, group", icon: Package },
  { id: "addons", label: "Add-ons", hint: "Prasad, live, daan", icon: PlusCircle },
  { id: "schedule", label: "Dates & capacity", hint: "Muhurat, seats, cutoff", icon: CalendarDays },
  { id: "sankalp", label: "Sankalp form", hint: "Names, gotra, wish", icon: ScrollText },
  { id: "policy", label: "Policy", hint: "Refunds, reschedule, SLA", icon: ShieldCheck },
  { id: "seo", label: "SEO", hint: "Google title and text", icon: Search },
] as const;
const OPTIONAL_SECTIONS = ["addons", "seo"];
type SectionMeta = (typeof SECTIONS)[number];
/** Sections shown for this type: havan-only sections are hidden for poojas. */
const sectionsFor = (type: Form["type"]): SectionMeta[] => SECTIONS.filter((s) => !("havanOnly" in s) || type === "havan");
/** Visible sections, so step numbers stay 1, 2, 3… for each type. */
const StepsContext = createContext<SectionMeta[]>(sectionsFor("pooja"));

/** Is a section filled enough? Sankalp and policy start with good defaults. */
function sectionState(id: string, f: PoojaInput): "done" | "todo" | "optional" {
  const s = f.schedule;
  switch (id) {
    case "basics": return f.title.trim().length >= 3 ? "done" : "todo";
    case "location": return f.location.mode === "our_pandits" || f.location.place.trim() ? "done" : "todo";
    case "content": return f.shortDescription.trim().length >= 20 ? "done" : "todo";
    case "media": return f.coverImage ? "done" : "todo";
    case "packages": return f.packages.some((p) => p.active && p.price >= 1) ? "done" : "todo";
    case "addons": return f.addOns.length ? "done" : "optional";
    case "schedule": return (s.mode === "weekly" ? s.weekdays.length > 0 && s.times.length > 0 : s.mode === "fixed_dates" ? s.fixedDates.length > 0 : true) ? "done" : "todo";
    case "seo": return f.seo.title || f.seo.description ? "done" : "optional";
    case "havan": return f.havan.samagri.some((x) => x.trim()) ? "done" : "todo";
    default: return "done";
  }
}

/** Premium stepper nav: progress, per-section status, error counts, scroll-spy. */
function SectionNav({ form, issueCount }: { form: PoojaInput; issueCount: (id: string) => number }) {
  const [active, setActive] = useState<string>("basics");
  const SECTIONS = useContext(StepsContext);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => e !== null);
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-110px 0px -55% 0px" });
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [SECTIONS]);

  const required = SECTIONS.filter((s) => !OPTIONAL_SECTIONS.includes(s.id));
  const done = required.filter((s) => sectionState(s.id, form) === "done" && issueCount(s.id) === 0).length;
  const pct = Math.round((done / required.length) * 100);
  const jump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  return (
    <>
      {/* desktop stepper */}
      <nav className="hidden lg:block" aria-label="Pooja setup sections">
        <div className="sticky top-24 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)", boxShadow: "0 18px 40px -26px rgba(20,20,40,0.35)" }}>
          <div className="relative overflow-hidden px-4 pb-4 pt-4" style={{ background: "linear-gradient(135deg, rgba(230,180,58,0.18), rgba(145,105,255,0.14))" }}>
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#e6b43a]/40 to-[#9169ff]/30 blur-2xl" />
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--a-gold)" }}><Flame size={12} /> Pooja setup</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{done} of {required.length} ready</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: "var(--a-fg)" }}>{pct}%</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
              <div className="h-full rounded-full bg-gradient-to-r from-[#e6b43a] to-[#9169ff] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ol className="relative p-2">
            {SECTIONS.map((x, i) => {
              const n = issueCount(x.id);
              const st = n > 0 ? "error" : sectionState(x.id, form);
              const on = active === x.id;
              const Icon = x.icon;
              const ring = st === "error" ? "bg-rose-500 text-white" : st === "done" ? "bg-emerald-500 text-white" : on ? "bg-gradient-to-br from-[#e6b43a] to-[#c9942a] text-white" : "";
              return (
                <li key={x.id} className="relative">
                  {i < SECTIONS.length - 1 && <span aria-hidden className="absolute left-[1.55rem] top-10 h-[calc(100%-1.75rem)] w-px" style={{ background: st === "done" ? "rgba(16,185,129,0.45)" : "var(--a-border)" }} />}
                  <a href={`#${x.id}`} onClick={(e) => jump(e, x.id)} aria-current={on ? "step" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${on ? "" : "hover:bg-black/[0.03]"}`}
                    style={on ? { background: "var(--a-gold-soft)" } : undefined}>
                    {on && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#e6b43a] to-[#9169ff]" />}
                    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold shadow-sm transition-colors ${ring}`}
                      style={ring ? { borderColor: "transparent" } : { borderColor: "var(--a-border)", background: "var(--a-surface)", color: "var(--a-muted)" }}>
                      {st === "done" ? <Check size={15} strokeWidth={3} /> : st === "error" ? n : <Icon size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold" style={{ color: on ? "var(--a-gold)" : "var(--a-fg)" }}>{x.label}</span>
                      <span className="block truncate text-[11px]" style={{ color: st === "error" ? "#be123c" : "var(--a-faint)" }}>
                        {st === "error" ? `${n} field${n > 1 ? "s" : ""} to fix` : st === "optional" ? "Optional" : x.hint}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      {/* mobile chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden" aria-label="Pooja setup sections">
        {SECTIONS.map((x) => {
          const n = issueCount(x.id);
          const st = n > 0 ? "error" : sectionState(x.id, form);
          return (
            <a key={x.id} href={`#${x.id}`} onClick={(e) => jump(e, x.id)} className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: active === x.id ? "var(--a-gold)" : "var(--a-border)", background: active === x.id ? "var(--a-gold-soft)" : "var(--a-surface)", color: "var(--a-fg)" }}>
              {st === "done" ? <Check size={12} className="text-emerald-600" /> : st === "error" ? <span className="rounded-full bg-rose-500 px-1 text-[10px] text-white">{n}</span> : <x.icon size={12} />}
              {x.label}
            </a>
          );
        })}
      </div>
    </>
  );
}
const sectionOf = (field: string) => {
  const f = field.split(".")[0];
  if (["type", "title", "subtitle", "deity", "category", "tags", "slug", "status", "featured", "sortOrder"].includes(f)) return "basics";
  if (["location", "durationMin", "panditCount", "mantraCount"].includes(f)) return "location";
  if (["shortDescription", "description", "benefits", "vidhi", "includes", "faqs"].includes(f)) return "content";
  if (["coverImage", "gallery", "videoUrl"].includes(f)) return "media";
  if (f === "packages") return "packages";
  if (f === "addOns") return "addons";
  return f;
};

const blankPackage = (n: number): PoojaPackage => ({ id: shortId("pk"), name: n === 0 ? "Individual" : "Family", kind: n === 0 ? "individual" : "family", members: n === 0 ? 1 : 4, price: n === 0 ? 1100 : 2100, mrp: null, description: "", perks: [], popular: false, active: true });
const blankAddOn = (): PoojaAddOn => ({ id: shortId("ad"), name: "Prasad delivery", kind: "prasad", description: "", price: 199, maxQty: 1, requiresAddress: true, active: true });

export function blankForm(type: Form["type"] = "pooja"): Form {
  return {
    type,
    havan: type === "havan" ? { ...blankHavan(), samagri: [...HAVAN_SAMAGRI_DEFAULT], deliverables: [...HAVAN_DELIVERABLES_DEFAULT] } : blankHavan(),
    title: "", subtitle: "", deity: "", category: "graha_shanti", tags: [], shortDescription: "", description: "",
    benefits: [], vidhi: [], includes: [], faqs: [], coverImage: "", gallery: [], videoUrl: "",
    location: { mode: "temple", place: "", city: "", state: "", mapUrl: "" }, durationMin: 60, panditCount: 1, mantraCount: 0,
    packages: [blankPackage(0)], addOns: [], schedule: blankSchedule(), sankalp: blankSankalp(), policy: blankPolicy(),
    seo: { title: "", description: "" }, status: "draft", featured: false, sortOrder: 0,
  };
}
function toForm(p: Pooja): Form {
  const { id: _i, createdAt: _c, updatedAt: _u, createdBy: _cb, updatedBy: _ub, ...rest } = p;
  void _i; void _c; void _u; void _cb; void _ub;
  return rest;
}

/* ---------------- small inputs ---------------- */
function Num({ label, hint, value, onChange, min }: { label: string; hint?: string; value: number | null; onChange: (n: number) => void; min?: number }) {
  return <Field label={label} hint={hint}><AdminInput type="number" min={min} value={value === null || Number.isNaN(value) ? "" : value} onChange={(e) => onChange(e.target.value === "" ? NaN : Math.round(Number(e.target.value)))} /></Field>;
}
function ListEditor({ label, hint, items, onChange, placeholder, max = 20, multiline }: { label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; max?: number; multiline?: boolean }) {
  const move = (i: number, d: -1 | 1) => { const n = [...items]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2.5 w-5 text-right text-xs" style={{ color: "var(--a-faint)" }}>{i + 1}.</span>
            {multiline ? <AdminTextarea rows={2} value={v} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} /> : <AdminInput value={v} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} placeholder={placeholder} />}
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="mt-2 p-1 disabled:opacity-30" style={{ color: "var(--a-muted)" }}><ArrowUp size={14} /></button>
            <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="mt-2 p-1 disabled:opacity-30" style={{ color: "var(--a-muted)" }}><ArrowDown size={14} /></button>
            <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))} className="mt-2 p-1 text-rose-600"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length < max && <button type="button" onClick={() => onChange([...items, ""])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add</button>}
      </div>
    </Field>
  );
}
function Section({ id, title, subtitle, issues, children, action }: { id: string; title: string; subtitle?: string; issues: Issue[]; children: React.ReactNode; action?: React.ReactNode }) {
  const SECTIONS = useContext(StepsContext);
  const step = SECTIONS.findIndex((s) => s.id === id) + 1;
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--a-gold)" }}>Step {step}{OPTIONAL_SECTIONS.includes(id) ? " · optional" : ""}</p>
            <h2 className="text-base font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h2>
            {subtitle && <p className="text-xs" style={{ color: "var(--a-muted)" }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {issues.length > 0 && (
        <ul className="space-y-0.5 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700" role="alert">
          {issues.map((i, k) => <li key={k}>{i.field.includes(".") ? `${i.field}: ` : ""}{i.message}</li>)}
        </ul>
      )}
      {children}
    </Card>
  );
}

/* ---------------- editor ---------------- */
export function PoojaEditor({ id, defaultType = "pooja" }: { id?: string; defaultType?: Form["type"] }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [form, setForm] = useState<Form | null>(id ? null : blankForm(defaultType));
  const [saved, setSaved] = useState<string>(id ? "" : JSON.stringify(blankForm(defaultType)));
  const visibleSections = useMemo(() => sectionsFor(form?.type ?? defaultType), [form?.type, defaultType]);
  const [meta, setMeta] = useState<Pooja | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [now, setNow] = useState(0);
  const [newBlackout, setNewBlackout] = useState("");

  useOnMount(async () => {
    setNow(Date.now());
    if (!id) return;
    const r = await poojaAdminApi.poojas.get(id);
    if (!r.ok) { setMissing(true); return; }
    const f = toForm(r.data);
    setForm(f); setSaved(JSON.stringify(f)); setMeta(r.data);
  });

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const clientIssues: Issue[] = useMemo(() => {
    if (!form) return [];
    const r = poojaInputSchema.safeParse(form);
    return r.success ? [] : r.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  }, [form]);
  const checklist = useMemo(() => (form ? publishIssues({ ...form, id: "x", slug: form.slug ?? "", createdBy: "", updatedBy: "", createdAt: "", updatedAt: "" } as Pooja) : []), [form]);
  const preview = useMemo(() => (form && now ? buildSlots({ schedule: form.schedule }, now, {}, { days: 30 }).slice(0, 8) : []), [form, now]);

  if (missing) return <EmptyState title="Pooja not found" message="It may have been deleted." />;
  if (!form) return <StatsSkeleton count={3} />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const noun = form.type === "havan" ? "havan" : "pooja";
  const issuesFor = (section: string) => [...clientIssues, ...serverIssues].filter((i) => sectionOf(i.field) === section);

  const submit = async (status?: Form["status"]) => {
    const body: Form = {
      ...form, status: status ?? form.status, slug: form.slug?.trim().replace(/^-+|-+$/g, "") || undefined,
      gallery: form.gallery.filter(Boolean),
      tags: form.tags.filter(Boolean),
      benefits: form.benefits.map((x) => x.trim()).filter(Boolean),
      includes: form.includes.map((x) => x.trim()).filter(Boolean),
      vidhi: form.vidhi.map((x) => x.trim()).filter(Boolean),
    };
    const check = poojaInputSchema.safeParse(body);
    if (!check.success) { toast("Fix the highlighted fields first", "error"); document.getElementById(sectionOf(check.error.issues[0].path.join(".")))?.scrollIntoView({ behavior: "smooth" }); return; }
    if (body.status === "active" && checklist.length) { toast(`Cannot publish yet: ${checklist[0]}`, "error"); return; }
    setSaving(true);
    const r = id ? await poojaAdminApi.poojas.save(id, check.data) : await poojaAdminApi.poojas.create(check.data);
    setSaving(false);
    if (!r.ok) {
      const det = Array.isArray(r.details) ? (r.details as Issue[]).filter((d) => d && typeof d.field === "string") : [];
      setServerIssues(det);
      toast(r.message, "error");
      return;
    }
    setServerIssues([]);
    const f = toForm(r.data);
    setForm(f); setSaved(JSON.stringify(f)); setMeta(r.data);
    toast(body.status === "active" ? "Pooja is live" : "Saved", "success");
    if (!id) router.replace(`/admin/poojas/${r.data.id}`);
  };

  const go = (href: string) => (dirty ? setLeaveTo(href) : router.push(href));

  const duplicate = async () => {
    if (!id) return;
    const r = await poojaAdminApi.poojas.duplicate(id);
    if (r.ok) { toast("Copied as a draft", "success"); router.push(`/admin/poojas/${r.data.id}`); } else toast(r.message, "error");
  };
  const remove = async () => {
    if (!id) return;
    const r = await poojaAdminApi.poojas.remove(id);
    if (r.ok) { toast("Deleted", "success"); setSaved(JSON.stringify(form)); router.replace("/admin/poojas"); } else toast(r.message, "error");
  };

  const s = form.schedule;
  const setS = (patch: Partial<Form["schedule"]>) => set("schedule", { ...s, ...patch });
  const setPkg = (i: number, patch: Partial<PoojaPackage>) => set("packages", form.packages.map((p, k) => (k === i ? { ...p, ...patch } : patch.popular ? { ...p, popular: false } : p)));
  const setAd = (i: number, patch: Partial<PoojaAddOn>) => set("addOns", form.addOns.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const totalIssues = clientIssues.length + serverIssues.length;

  return (
    <StepsContext.Provider value={visibleSections}>
    <div className="pb-24">
      <AdminBreadcrumb items={[{ label: "Poojas & Havan", href: "/admin/poojas" }, { label: id ? form.title || "Untitled" : `New ${noun}` }]} />
      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>{id ? form.title || `Untitled ${noun}` : `New ${noun}`} {form.type === "havan" && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #e6b43a, #c9942a)" }}>Havan</span>} <StatusPill tone={POOJA_STATUS[form.status].tone}>{POOJA_STATUS[form.status].label}</StatusPill></h1>
          {meta && <p className="text-xs" style={{ color: "var(--a-muted)" }}>Last saved {new Date(meta.updatedAt).toLocaleString("en-IN")} by {meta.updatedBy || "admin"}</p>}
        </div>
        {id && (
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="outline" onClick={() => go(`/admin/poojas/bookings?poojaId=${id}`)}><CalendarDays size={15} /> Bookings</AdminButton>
            <AdminButton variant="outline" onClick={duplicate}><Copy size={15} /> Duplicate</AdminButton>
            {meta?.status === "active" && <a href={`/pooja/${meta.slug}`} target="_blank" rel="noopener noreferrer"><AdminButton variant="ghost"><ExternalLink size={15} /> View</AdminButton></a>}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[15.5rem_1fr_17rem]">
        {/* section nav */}
        <SectionNav form={form} issueCount={(sid) => issuesFor(sid).length} />

        <div className="min-w-0 space-y-6">
          {/* BASICS */}
          <Section id="basics" title="Basics" issues={issuesFor("basics")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pooja name" required><AdminInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Rudrabhishek Pooja" maxLength={120} /></Field>
              <Field label="Subtitle" hint="One line under the name"><AdminInput value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="For health, peace and removal of obstacles" maxLength={160} /></Field>
              <Field label="Deity"><AdminInput value={form.deity} onChange={(e) => set("deity", e.target.value)} placeholder="Lord Shiva" maxLength={60} /></Field>
              <div className="sm:col-span-2"><TypeChooser value={form.type} onChange={(t) => setForm({ ...form, type: t, havan: t === "havan" && form.havan.samagri.length === 0 ? { ...form.havan, samagri: [...HAVAN_SAMAGRI_DEFAULT], deliverables: form.havan.deliverables.length ? form.havan.deliverables : [...HAVAN_DELIVERABLES_DEFAULT] } : form.havan, schedule: t === "havan" && form.havan.mode === "ekal" ? { ...form.schedule, slotCapacity: 1 } : form.schedule })} /></div>
              <CategoryField value={form.category} onChange={(key) => set("category", key)} />
              <Field label="Page URL" hint={`/${form.type === "havan" ? "havan" : "pooja"}/${form.slug || "auto-from-name"}`}><AdminInput value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90))} placeholder="auto from name" /></Field>
              <Field label="Tags" hint="Comma separated, used in search"><AdminInput value={form.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 15))} placeholder="shiv, sawan, health" /></Field>
              <Num label="Sort order" hint="Lower shows first" value={form.sortOrder} onChange={(n) => set("sortOrder", n)} />
            </div>
            <Toggle checked={form.featured} onChange={(v) => set("featured", v)} label="Feature on the pooja home page" />
            {id && meta && form.slug !== meta.slug && meta.status === "active" && <p className="flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} /> Changing the URL of a live pooja breaks links already shared.</p>}
          </Section>

          {/* LOCATION */}
          <Section id="location" title="Location & ritual" issues={issuesFor("location")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Performed at"><AdminSelectPro value={form.location.mode} onChange={(e) => set("location", { ...form.location, mode: e.target.value as Form["location"]["mode"] })}>{LOCATION_MODES.map((m) => <option key={m} value={m}>{LOCATION_LABEL[m]}</option>)}</AdminSelectPro></Field>
              <Field label={form.location.mode === "our_pandits" ? "Place (optional)" : "Temple / place name"}><AdminInput value={form.location.place} onChange={(e) => set("location", { ...form.location, place: e.target.value })} placeholder="Kashi Vishwanath Temple" /></Field>
              <Field label="City"><AdminInput value={form.location.city} onChange={(e) => set("location", { ...form.location, city: e.target.value })} /></Field>
              <Field label="State"><AdminInput value={form.location.state} onChange={(e) => set("location", { ...form.location, state: e.target.value })} /></Field>
              <Field label="Map link (optional)"><AdminInput value={form.location.mapUrl} onChange={(e) => set("location", { ...form.location, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Num label="Duration (minutes)" value={form.durationMin} onChange={(n) => set("durationMin", n)} min={10} />
              <Num label="Pandits performing" value={form.panditCount} onChange={(n) => set("panditCount", n)} min={1} />
              <Num label="Mantra jaap count" hint="0 to hide" value={form.mantraCount} onChange={(n) => set("mantraCount", n)} min={0} />
            </div>
          </Section>

          {/* HAVAN */}
          {form.type === "havan" && (
            <Section id="havan" title="Havan & anushthan" subtitle="Ekal or samuhik, number of days, samagri and what the devotee receives" issues={issuesFor("havan")}>
              <HavanFields havan={form.havan} onChange={(h) => set("havan", h)} slotCapacity={form.schedule.slotCapacity} onSlotCapacity={(n) => setForm((f) => (f ? { ...f, schedule: { ...f.schedule, slotCapacity: n } } : f))} />
            </Section>
          )}

          {/* CONTENT */}
          <Section id="content" title="Content" subtitle="What customers read on the pooja page" issues={issuesFor("content")}>
            <Field label="Short description" hint={`${form.shortDescription.length}/300 · shown on cards and at the top`}><AdminTextarea rows={2} value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value.slice(0, 300))} /></Field>
            <Field label="Full description" hint="About the pooja, its significance and who should do it"><AdminTextarea rows={8} value={form.description} onChange={(e) => set("description", e.target.value.slice(0, 20000))} /></Field>
            <div className="grid gap-6 md:grid-cols-2">
              <ListEditor label="Benefits" items={form.benefits} onChange={(v) => set("benefits", v)} placeholder="Removes obstacles in career" />
              <ListEditor label="What you get" items={form.includes} onChange={(v) => set("includes", v)} placeholder="Sankalp in your name and gotra" />
            </div>
            <ListEditor label="Vidhi (steps of the ritual)" items={form.vidhi} onChange={(v) => set("vidhi", v)} placeholder="Ganesh pujan and sankalp" max={30} multiline />
            <Field label="FAQs">
              <div className="space-y-3">
                {form.faqs.map((f, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                    <div className="flex gap-2"><AdminInput value={f.q} onChange={(e) => set("faqs", form.faqs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))} placeholder="Question" /><button type="button" aria-label="Remove FAQ" onClick={() => set("faqs", form.faqs.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button></div>
                    <AdminTextarea rows={2} value={f.a} onChange={(e) => set("faqs", form.faqs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))} placeholder="Answer" />
                  </div>
                ))}
                {form.faqs.length < 20 && <button type="button" onClick={() => set("faqs", [...form.faqs, { q: "", a: "" }])} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add FAQ</button>}
              </div>
            </Field>
          </Section>

          {/* MEDIA */}
          <Section id="media" title="Images & video" issues={issuesFor("media")}>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Cover image" required hint="16:9, at least 1200 px wide"><ImagePickerField value={form.coverImage} onChange={(u) => set("coverImage", u)} folder="poojas" /></Field>
              <Field label="Video link (optional)" hint="YouTube or a hosted video, https://"><AdminInput value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtube.com/watch?v=..." /></Field>
            </div>
            <Field label={`Gallery (${form.gallery.length}/12)`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {form.gallery.map((g, i) => (
                  <div key={i} className="space-y-1">
                    <ImagePickerField value={g} onChange={(u) => set("gallery", u ? form.gallery.map((x, k) => (k === i ? u : x)) : form.gallery.filter((_, k) => k !== i))} folder="poojas" aspect="aspect-square" />
                  </div>
                ))}
                {form.gallery.length < 12 && <button type="button" onClick={() => set("gallery", [...form.gallery, ""])} className="flex aspect-square items-center justify-center rounded-lg border border-dashed text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}><Plus size={16} /> Add image</button>}
              </div>
            </Field>
          </Section>

          {/* PACKAGES */}
          <Section id="packages" title="Packages" subtitle="Price changes never affect existing bookings" issues={issuesFor("packages")}
            action={<AdminButton variant="outline" disabled={form.packages.length >= 8} onClick={() => set("packages", [...form.packages, blankPackage(form.packages.length)])}><Plus size={15} /> Add package</AdminButton>}>
            {form.packages.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No packages yet.</p>}
            {form.packages.map((p, i) => (
              <div key={p.id} className="space-y-3 rounded-lg border p-4" style={{ borderColor: p.popular ? "var(--a-gold)" : "var(--a-border)", opacity: p.active ? 1 : 0.65 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{p.name || "Package"} {p.popular && <Badge tone="gold">Popular</Badge>}{!p.active && <Badge tone="muted">Hidden</Badge>}</p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setPkg(i, { popular: !p.popular })} className="flex items-center gap-1 text-xs" style={{ color: p.popular ? "var(--a-gold)" : "var(--a-muted)" }}><Star size={13} /> {p.popular ? "Popular" : "Mark popular"}</button>
                    <Toggle checked={p.active} onChange={(v) => setPkg(i, { active: v })} label="Active" />
                    <button type="button" aria-label="Remove package" onClick={() => set("packages", form.packages.filter((_, k) => k !== i))} className="text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <Field label="Name"><AdminInput value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} /></Field>
                  <Field label="Type"><AdminSelectPro value={p.kind} onChange={(e) => { const kind = e.target.value as PoojaPackage["kind"]; setPkg(i, { kind, members: kind === "individual" ? 1 : kind === "couple" ? 2 : kind === "family" ? Math.max(p.members, 4) : 1 }); }}>{PACKAGE_KINDS.map((k) => <option key={k} value={k}>{PACKAGE_LABEL[k]}</option>)}</AdminSelectPro></Field>
                  <Num label="Names in sankalp" value={p.members} onChange={(n) => setPkg(i, { members: n })} min={1} />
                  <Num label="Price (₹)" value={p.price} onChange={(n) => setPkg(i, { price: n })} min={0} />
                  <Num label="MRP (₹, optional)" value={p.mrp} onChange={(n) => setPkg(i, { mrp: Number.isNaN(n) ? null : n })} min={0} />
                </div>
                <Field label="Description"><AdminInput value={p.description} onChange={(e) => setPkg(i, { description: e.target.value })} placeholder={p.kind === "group" ? "Samuhik pooja with many devotees, your name in the sankalp" : "Pooja performed only for you"} /></Field>
                {form.type === "havan" && <TierFields pkg={p} onChange={(patch) => setPkg(i, patch)} />}
                <Field label="Perks" hint="Comma separated"><AdminInput value={p.perks.join(", ")} onChange={(e) => setPkg(i, { perks: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) })} placeholder="Video of the pooja, Prasad, Certificate" /></Field>
                {p.mrp && p.mrp > p.price ? <p className="text-xs text-emerald-700">Shows {Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</p> : null}
              </div>
            ))}
          </Section>

          {/* ADD-ONS */}
          <Section id="addons" title="Add-ons" subtitle="Prasad, live video, extra jaap, daan…" issues={issuesFor("addons")}
            action={<AdminButton variant="outline" disabled={form.addOns.length >= 15} onClick={() => set("addOns", [...form.addOns, blankAddOn()])}><Plus size={15} /> Add add-on</AdminButton>}>
            {form.addOns.length === 0 && <p className="text-sm" style={{ color: "var(--a-faint)" }}>No add-ons. Customers book the package only.</p>}
            {form.addOns.map((a, i) => (
              <div key={a.id} className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--a-border)", opacity: a.active ? 1 : 0.65 }}>
                <div className="grid gap-3 sm:grid-cols-[1fr_10rem_7rem_6rem_auto]">
                  <Field label="Name"><AdminInput value={a.name} onChange={(e) => setAd(i, { name: e.target.value })} /></Field>
                  <Field label="Type"><AdminSelectPro value={a.kind} onChange={(e) => { const kind = e.target.value as PoojaAddOn["kind"]; setAd(i, { kind, requiresAddress: kind === "prasad" || kind === "product" }); }}>{ADDON_KINDS.map((k) => <option key={k} value={k}>{ADDON_LABEL[k]}</option>)}</AdminSelectPro></Field>
                  <Num label="Price (₹)" value={a.price} onChange={(n) => setAd(i, { price: n })} min={0} />
                  <Num label="Max qty" value={a.maxQty} onChange={(n) => setAd(i, { maxQty: n })} min={1} />
                  <button type="button" aria-label="Remove add-on" onClick={() => set("addOns", form.addOns.filter((_, k) => k !== i))} className="mt-6 text-rose-600"><Trash2 size={15} /></button>
                </div>
                <Field label="Description"><AdminInput value={a.description} onChange={(e) => setAd(i, { description: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-6">
                  <Toggle checked={a.requiresAddress} onChange={(v) => setAd(i, { requiresAddress: v })} label="Needs a delivery address" />
                  <Toggle checked={a.active} onChange={(v) => setAd(i, { active: v })} label="Active" />
                </div>
              </div>
            ))}
          </Section>

          {/* SCHEDULE */}
          <Section id="schedule" title="Dates & capacity" subtitle="All times are IST" issues={issuesFor("schedule")}>
            <Field label="How dates work">
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                {([["weekly", "Every week", "Same days and times each week"], ["fixed_dates", "Fixed dates", "Festivals and special muhurat"], ["on_request", "Any day", "Customer picks the date"]] as const).map(([m, t, d]) => (
                  <button key={m} type="button" role="radio" aria-checked={s.mode === m} onClick={() => setS({ mode: m })} className="rounded-lg border p-3 text-left" style={{ borderColor: s.mode === m ? "var(--a-gold)" : "var(--a-border)", background: s.mode === m ? "var(--a-gold-soft)" : undefined }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{t}</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>{d}</p>
                  </button>
                ))}
              </div>
            </Field>
            {s.mode === "weekly" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Days">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d, i) => { const on = s.weekdays.includes(i); return <button key={d} type="button" aria-pressed={on} onClick={() => setS({ weekdays: on ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort() })} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", color: on ? "var(--a-gold)" : "var(--a-muted)", background: on ? "var(--a-gold-soft)" : undefined }}>{d}</button>; })}
                  </div>
                </Field>
                <Field label="Start times">
                  <div className="space-y-2">
                    {s.times.map((t, i) => (
                      <div key={i} className="flex gap-2"><AdminInput type="time" value={t} onChange={(e) => setS({ times: s.times.map((x, k) => (k === i ? e.target.value : x)) })} className="w-36" /><button type="button" aria-label="Remove time" onClick={() => setS({ times: s.times.filter((_, k) => k !== i) })} className="text-rose-600"><Trash2 size={15} /></button></div>
                    ))}
                    {s.times.length < 12 && <button type="button" onClick={() => setS({ times: [...s.times, "18:00"] })} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add time</button>}
                  </div>
                </Field>
              </div>
            )}
            {s.mode === "fixed_dates" && (
              <Field label="Dates">
                <div className="space-y-2">
                  {s.fixedDates.map((f, i) => (
                    <div key={f.id} className="grid items-end gap-2 sm:grid-cols-[9.5rem_7rem_1fr_7rem_7rem_auto]">
                      <AdminInput type="date" value={f.date} onChange={(e) => setS({ fixedDates: s.fixedDates.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)) })} aria-label="Date" />
                      <AdminInput type="time" value={f.time} onChange={(e) => setS({ fixedDates: s.fixedDates.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)) })} aria-label="Time" />
                      <AdminInput value={f.label} onChange={(e) => setS({ fixedDates: s.fixedDates.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} placeholder="Mahashivratri" aria-label="Label" />
                      <AdminInput type="number" value={f.capacity ?? ""} onChange={(e) => setS({ fixedDates: s.fixedDates.map((x, k) => (k === i ? { ...x, capacity: e.target.value === "" ? null : Math.round(Number(e.target.value)) } : x)) })} placeholder={`Seats (${s.slotCapacity})`} aria-label="Seats" />
                      <AdminInput type="number" value={f.priceDelta} onChange={(e) => setS({ fixedDates: s.fixedDates.map((x, k) => (k === i ? { ...x, priceDelta: Math.round(Number(e.target.value) || 0) } : x)) })} aria-label="Extra price" title="Extra ₹ on every package for this date" />
                      <button type="button" aria-label="Remove date" onClick={() => setS({ fixedDates: s.fixedDates.filter((_, k) => k !== i) })} className="mb-2 text-rose-600"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Columns: date · time · label · seats (empty = default) · extra ₹ for this date (can be negative)</p>
                  <button type="button" onClick={() => setS({ fixedDates: [...s.fixedDates, { id: shortId("fd"), date: "", time: "07:00", label: "", capacity: null, priceDelta: 0 }] })} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add date</button>
                </div>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Num label={s.mode === "on_request" ? "Bookings per day" : "Seats per slot"} hint={s.mode === "on_request" ? "" : "Group poojas can have hundreds"} value={s.slotCapacity} onChange={(n) => setS({ slotCapacity: n })} min={1} />
              <Num label="Booking closes (hours before)" value={s.cutoffHours} onChange={(n) => setS({ cutoffHours: n })} min={0} />
              <Num label="Bookable days ahead" value={s.advanceDays} onChange={(n) => setS({ advanceDays: n })} min={1} />
            </div>
            <Field label="No pooja on these dates" hint="Eclipse, temple closed, festival rush…">
              <div className="flex flex-wrap items-center gap-2">
                {s.blackoutDates.map((d) => <span key={d} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>{d}<button type="button" aria-label={`Remove ${d}`} onClick={() => setS({ blackoutDates: s.blackoutDates.filter((x) => x !== d) })}><Trash2 size={11} /></button></span>)}
                <AdminInput type="date" value={newBlackout} onChange={(e) => setNewBlackout(e.target.value)} className="w-40" aria-label="Add blocked date" />
                <AdminButton variant="ghost" disabled={!isDate(newBlackout) || s.blackoutDates.includes(newBlackout)} onClick={() => { setS({ blackoutDates: [...s.blackoutDates, newBlackout].sort() }); setNewBlackout(""); }}><Plus size={14} /> Block date</AdminButton>
              </div>
            </Field>
            <div className="rounded-lg p-3" style={{ background: "var(--a-surface-2)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--a-faint)" }}>Next slots customers will see</p>
              {preview.length === 0 ? <p className="text-sm" style={{ color: "var(--a-muted)" }}>No upcoming slots with these settings.</p> : (
                <ul className="grid gap-1 text-sm sm:grid-cols-2">{preview.map((x) => <li key={x.key} style={{ color: x.closed ? "var(--a-faint)" : "var(--a-fg)" }}>{fmtSlot(x.date, x.time)}{x.label ? ` · ${x.label}` : ""} · {x.capacity} seats{x.priceDelta ? ` · ${x.priceDelta > 0 ? "+" : ""}${inr(x.priceDelta)}` : ""}{x.closed ? " (closed)" : ""}</li>)}</ul>
              )}
            </div>
          </Section>

          {/* SANKALP */}
          <Section id="sankalp" title="Sankalp form" subtitle="What customers fill in for each name" issues={issuesFor("sankalp")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle checked={form.sankalp.requireGotra} onChange={(v) => set("sankalp", { ...form.sankalp, requireGotra: v })} label="Ask for gotra" />
              <Toggle checked={form.sankalp.askRelation} onChange={(v) => set("sankalp", { ...form.sankalp, askRelation: v })} label="Ask relation (self, wife, son…)" />
              <Toggle checked={form.sankalp.requireDob} onChange={(v) => set("sankalp", { ...form.sankalp, requireDob: v })} label="Date of birth required" />
              <Toggle checked={form.sankalp.requireBirthPlace} onChange={(v) => set("sankalp", { ...form.sankalp, requireBirthPlace: v })} label="Birth place required" />
              <Toggle checked={form.sankalp.requireWish} onChange={(v) => set("sankalp", { ...form.sankalp, requireWish: v })} label="Sankalp (wish) required" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Gotra if they do not know" hint="Traditionally Kashyap"><AdminInput value={form.sankalp.defaultGotra} onChange={(e) => set("sankalp", { ...form.sankalp, defaultGotra: e.target.value })} /></Field>
              <Num label="Max sankalp length" value={form.sankalp.wishMaxLength} onChange={(n) => set("sankalp", { ...form.sankalp, wishMaxLength: n })} min={50} />
            </div>
            <Field label="Instructions shown on the form"><AdminTextarea rows={2} value={form.sankalp.instructions} onChange={(e) => set("sankalp", { ...form.sankalp, instructions: e.target.value.slice(0, 500) })} placeholder="Enter names exactly as you want them spoken in the sankalp." /></Field>
          </Section>

          {/* POLICY */}
          <Section id="policy" title="Cancellation, reschedule & delivery" subtitle="Saved into each booking when it is made" issues={issuesFor("policy")}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Num label="Free reschedule until (hours before)" value={form.policy.freeRescheduleHours} onChange={(n) => set("policy", { ...form.policy, freeRescheduleHours: n })} min={0} />
              <Num label="Max reschedules" value={form.policy.maxReschedules} onChange={(n) => set("policy", { ...form.policy, maxReschedules: n })} min={0} />
              <Num label="Upload proof within (hours)" value={form.policy.proofSlaHours} onChange={(n) => set("policy", { ...form.policy, proofSlaHours: n })} min={1} />
              <Num label="Dispatch prasad within (days)" value={form.policy.prasadDispatchDays} onChange={(n) => set("policy", { ...form.policy, prasadDispatchDays: n })} min={0} />
            </div>
            <Field label="Refund on cancellation" hint="Rules are checked from the longest notice down. Less notice than the last rule = no refund.">
              <div className="space-y-2">
                {form.policy.refundTiers.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--a-fg)" }}>
                    Cancelled at least <AdminInput type="number" className="w-24" value={Number.isNaN(t.hoursBefore) ? "" : t.hoursBefore} onChange={(e) => set("policy", { ...form.policy, refundTiers: form.policy.refundTiers.map((x, k) => (k === i ? { ...x, hoursBefore: Math.round(Number(e.target.value)) } : x)) })} aria-label="Hours before" /> hours before → refund
                    <AdminInput type="number" className="w-20" value={Number.isNaN(t.refundPct) ? "" : t.refundPct} onChange={(e) => set("policy", { ...form.policy, refundTiers: form.policy.refundTiers.map((x, k) => (k === i ? { ...x, refundPct: Math.round(Number(e.target.value)) } : x)) })} aria-label="Refund percent" /> %
                    <button type="button" aria-label="Remove rule" onClick={() => set("policy", { ...form.policy, refundTiers: form.policy.refundTiers.filter((_, k) => k !== i) })} className="text-rose-600"><Trash2 size={15} /></button>
                  </div>
                ))}
                {form.policy.refundTiers.length < 6 && <button type="button" onClick={() => set("policy", { ...form.policy, refundTiers: [...form.policy.refundTiers, { hoursBefore: 12, refundPct: 0 }] })} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--a-gold)" }}><Plus size={13} /> Add rule</button>}
                {form.policy.refundTiers.length === 0 && <p className="text-xs text-amber-700">No refund rules: cancellations get no automatic refund (admins can still refund manually).</p>}
              </div>
            </Field>
          </Section>

          {/* SEO */}
          <Section id="seo" title="SEO" issues={issuesFor("seo")}>
            <Field label="Search title" hint={`${form.seo.title.length}/70 · empty = pooja name`}><AdminInput value={form.seo.title} onChange={(e) => set("seo", { ...form.seo, title: e.target.value.slice(0, 70) })} /></Field>
            <Field label="Search description" hint={`${form.seo.description.length}/170 · empty = short description`}><AdminTextarea rows={2} value={form.seo.description} onChange={(e) => set("seo", { ...form.seo, description: e.target.value.slice(0, 170) })} /></Field>
            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--a-border)" }}>
              <p className="text-[#1a0dab]">{form.seo.title || form.title || "Pooja name"} | Astrounkle</p>
              <p className="text-xs text-emerald-700">astrounkle.com/pooja/{form.slug || "url"}</p>
              <p className="line-clamp-2 text-xs" style={{ color: "var(--a-muted)" }}>{form.seo.description || form.shortDescription || "Description"}</p>
            </div>
          </Section>

          {id && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div><p className="text-sm font-semibold text-rose-700">Delete pooja</p><p className="text-xs" style={{ color: "var(--a-muted)" }}>Only possible when it has no bookings. Otherwise archive it.</p></div>
              <AdminButton variant="danger" onClick={() => setAskDelete(true)}><Trash2 size={15} /> Delete</AdminButton>
            </Card>
          )}
        </div>

        {/* right: publish */}
        <aside className="space-y-4">
          <Card className="sticky top-24 space-y-4 p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Publish checklist</p>
            <ul className="space-y-1.5 text-sm">
              {["Add a cover image", "Write a short description (20+ characters)", "Add at least one active package", "Every active package needs a price of at least ₹1", form.schedule.mode === "weekly" ? "Pick weekdays and at least one time" : form.schedule.mode === "fixed_dates" ? "Add at least one date" : "", form.location.mode !== "our_pandits" ? "Add the temple or place name" : ""].filter(Boolean).map((c) => {
                const bad = checklist.includes(c);
                return <li key={c} className="flex items-start gap-2" style={{ color: bad ? "var(--a-fg)" : "var(--a-muted)" }}>{bad ? <Circle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--a-faint)" }} /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />}{c}</li>;
              })}
            </ul>
            {totalIssues > 0 && <p className="flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle size={13} /> {totalIssues} field{totalIssues > 1 ? "s" : ""} to fix</p>}
            <Field label="Status">
              <AdminSelectPro value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
                <option value="draft">Draft (hidden)</option><option value="active">Live</option><option value="paused">Paused (visible, no new bookings)</option><option value="archived">Archived (hidden)</option>
              </AdminSelectPro>
            </Field>
            <AdminButton className="w-full" onClick={() => submit()} disabled={saving || !dirty && !!id}><Save size={15} /> {saving ? "Saving…" : "Save"}</AdminButton>
            {form.status !== "active" && <AdminButton className="w-full" variant="outline" onClick={() => submit("active")} disabled={saving || checklist.length > 0}><Send size={15} /> Save & go live</AdminButton>}
            {dirty && <p className="text-center text-xs" style={{ color: "var(--a-gold)" }}>Unsaved changes</p>}
          </Card>
        </aside>
      </div>

      <div className="mt-6"><Link href="/admin/poojas" onClick={(e) => { if (dirty) { e.preventDefault(); setLeaveTo("/admin/poojas"); } }} className="text-sm" style={{ color: "var(--a-muted)" }}>← Back to poojas</Link></div>

      <ConfirmDialog open={!!leaveTo} onClose={() => setLeaveTo(null)} onConfirm={() => { const to = leaveTo; setSaved(JSON.stringify(form)); setLeaveTo(null); if (to) router.push(to); }} title="Leave without saving?" message="Your changes on this page will be lost." confirmLabel="Leave" danger />
      <ConfirmDialog open={askDelete} onClose={() => setAskDelete(false)} onConfirm={remove} title="Delete this pooja?" message="This cannot be undone. Poojas with bookings cannot be deleted; archive them instead." confirmLabel="Delete" danger />
    </div>
    </StepsContext.Provider>
  );
}
