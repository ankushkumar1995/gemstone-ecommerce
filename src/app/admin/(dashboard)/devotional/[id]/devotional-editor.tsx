"use client";

/**
 * Admin: add or edit one mantra / aarti / chalisa / stotra / katha / bhajan.
 * Text, meaning (English + Hindi), when to chant, audio (upload, length read
 * here in the browser), cover image, and a live preview of the app card.
 * Saving checks the same rules as the server; publish puts it in the app.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon, Music, Save, Trash2, Upload, X } from "lucide-react";
import { AdminBreadcrumb, AdminButton, AdminInput, AdminSelect, AdminTextarea, Badge, Card, ConfirmDialog, Field, PageHeader, StatsSkeleton, Toggle, useAdminToast } from "@/app/admin/_components";
import { devotionalAdminApi, type DevotionalItem } from "@/lib/admin-astro-api";
import { DEVOTIONAL_KINDS, KIND_LABEL, PLANETS, type DevotionalKind } from "@/modules/devotional/devotional.types";

type Draft = Omit<DevotionalItem, "id" | "plays" | "jaapCount" | "createdAt" | "updatedAt" | "updatedBy">;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COUNTS = [1, 3, 5, 7, 11, 21, 27, 51, 108];
const empty = (): Draft => ({
  slug: "", kind: "mantra", status: "draft", title: "", titleHi: "", deity: "", devanagari: "", roman: "", meaning: { en: "", hi: "" },
  blurb: "", verses: [], benefits: [], bestTime: "", days: [], planets: [], festivals: [], tags: [], defaultCount: 11, recitationSec: 30,
  audio: null, image: null, featured: false, order: 100,
});
const slugify = (s: string, kind: DevotionalKind) => `${kind === "mantra" ? "m" : "l"}-${s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)}`;
const toBlocks = (s: string) => s.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
const toLines = (s: string) => s.split("\n").map((b) => b.trim()).filter(Boolean);
const toList = (s: string) => s.split(",").map((b) => b.trim()).filter(Boolean);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Read an audio file's length in the browser (no server tools needed). */
function audioLength(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => { const d = Number.isFinite(a.duration) ? a.duration : 0; URL.revokeObjectURL(url); resolve(Math.round(d * 10) / 10); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    a.src = url;
  });
}

export function DevotionalEditor({ id }: { id: string | null }) {
  const { toast } = useAdminToast();
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(id ? null : empty());
  const [meta, setMeta] = useState<Pick<DevotionalItem, "plays" | "jaapCount" | "updatedAt" | "updatedBy"> | null>(null);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [versesRaw, setVersesRaw] = useState("");
  const [benefitsRaw, setBenefitsRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"audio" | "image" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    void devotionalAdminApi.get(id).then((r) => {
      if (!r.ok) { toast(r.message, "error"); router.replace("/admin/devotional"); return; }
      const { id: _i, plays, jaapCount, createdAt: _c, updatedAt, updatedBy, ...rest } = r.data.item;
      void _i; void _c;
      setD(rest);
      setMeta({ plays, jaapCount, updatedAt, updatedBy });
      setVersesRaw(rest.verses.join("\n\n"));
      setBenefitsRaw(rest.benefits.join("\n"));
    });
  }, [id, router, toast]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => (cur ? { ...cur, [k]: v } : cur));
  const isMantra = d?.kind === "mantra";
  const verses = useMemo(() => toBlocks(versesRaw), [versesRaw]);

  async function upload(file: File, type: "audio" | "image") {
    setUploading(type);
    const [r, len] = await Promise.all([devotionalAdminApi.upload(file, type), type === "audio" ? audioLength(file) : Promise.resolve(0)]);
    setUploading(null);
    if (!r.ok) return toast(r.message, "error");
    if (type === "image") { set("image", r.data.url); toast("Image uploaded. Save to keep it.", "info"); return; }
    set("audio", { url: r.data.url, key: r.data.key, bytes: r.data.bytes, durationSec: len, artist: d?.audio?.artist ?? "", license: d?.audio?.license ?? "" });
    if (len > 0 && isMantra) set("recitationSec", Math.max(3, Math.round(len)));
    toast(len > 0 ? `Audio uploaded (${mmss(len)}). Save to keep it.` : "Audio uploaded. Enter its length in seconds, then save.", "info");
  }

  async function save(publish?: boolean) {
    if (!d) return;
    const body: Draft = { ...d, verses, benefits: toLines(benefitsRaw), status: publish === undefined ? d.status : publish ? "published" : "draft" };
    setSaving(true);
    const r = id ? await devotionalAdminApi.update(id, body) : await devotionalAdminApi.create(body);
    setSaving(false);
    if (!r.ok) {
      const issues = ((r.details as { issues?: { path: (string | number)[]; message: string }[] } | undefined)?.issues ?? []);
      setErrors(Object.fromEntries(issues.map((x) => [String(x.path[0] ?? ""), x.message])));
      return toast(r.message, "error");
    }
    setErrors({});
    toast(body.status === "published" ? "Saved. It is live in the app." : "Saved as draft.", "success");
    if (!id) router.replace(`/admin/devotional/${r.data.item.id}`);
    else { setD((cur) => (cur ? { ...cur, status: r.data.item.status } : cur)); setMeta((m) => (m ? { ...m, updatedAt: r.data.item.updatedAt, updatedBy: r.data.item.updatedBy } : m)); }
  }

  async function remove() {
    if (!id) return;
    const r = await devotionalAdminApi.remove(id);
    if (!r.ok) return toast(r.message, "error");
    toast("Deleted", "success");
    router.replace("/admin/devotional");
  }

  if (!d) return <StatsSkeleton count={4} />;
  const err = (k: string) => (errors[k] ? <p className="mt-1 text-xs text-rose-600">{errors[k]}</p> : null);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: "Mantras & Aarti", href: "/admin/devotional" }, { label: id ? d.title || "Edit" : "Add new" }]} />
      <PageHeader title={id ? d.title || "Edit" : "Add new"} subtitle={meta ? `${meta.plays.toLocaleString("en-IN")} plays${d.kind === "mantra" ? ` · ${meta.jaapCount.toLocaleString("en-IN")} jaap` : ""} · last saved ${new Date(meta.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${meta.updatedBy ? ` by ${meta.updatedBy}` : ""}` : "Fill the details. Save as draft, then publish when ready."}
        action={<div className="flex flex-wrap gap-2">
          <Link href="/admin/devotional"><AdminButton variant="outline"><ArrowLeft size={15} /> Back</AdminButton></Link>
          {id && <AdminButton variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</AdminButton>}
          <AdminButton variant="outline" loading={saving} onClick={() => save()}><Save size={15} /> Save</AdminButton>
          <AdminButton loading={saving} onClick={() => save(d.status !== "published")}>{d.status === "published" ? "Unpublish" : "Save & publish"}</AdminButton>
        </div>} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Basics</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <AdminSelect value={d.kind} onChange={(e) => { const k = e.target.value as DevotionalKind; set("kind", k); if (!slugTouched && d.title) set("slug", slugify(d.title, k)); }}>
                  {DEVOTIONAL_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                </AdminSelect>
              </Field>
              <Field label="Deity"><AdminInput value={d.deity} onChange={(e) => set("deity", e.target.value)} placeholder="Shiva, Hanuman, Lakshmi…" maxLength={60} /></Field>
              <Field label="Title (English)">
                <AdminInput value={d.title} maxLength={140} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value, d.kind)); }} placeholder="Hanuman Chalisa" />
                {err("title")}
              </Field>
              <Field label="Title (Hindi)"><AdminInput value={d.titleHi} onChange={(e) => set("titleHi", e.target.value)} placeholder="हनुमान चालीसा" maxLength={200} /></Field>
              <Field label="Slug" hint="Web address and app id. Do not change after publishing.">
                <AdminInput value={d.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} maxLength={80} />
                {err("slug")}
              </Field>
              <Field label="Short description" hint="Shown in lists"><AdminInput value={d.blurb} onChange={(e) => set("blurb", e.target.value)} maxLength={300} /></Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle checked={d.featured} onChange={(v) => set("featured", v)} label="Featured (shown first, can be today's mantra)" />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>{isMantra ? "Mantra text" : "Text"}</p>
            <Field label={isMantra ? "Mantra (Devanagari)" : "First line (Devanagari)"} hint={isMantra ? "Shown large in the player" : "Shown under the title in lists"}>
              <AdminTextarea value={d.devanagari} onChange={(e) => set("devanagari", e.target.value)} rows={isMantra ? 3 : 2} className="text-lg" />
              {err("devanagari")}
            </Field>
            <Field label="In English letters (Roman)"><AdminTextarea value={d.roman} onChange={(e) => set("roman", e.target.value)} rows={2} /></Field>
            {!isMantra && (
              <Field label="Full text" hint={`${verses.length} blocks · leave an empty line between verses / paragraphs`}>
                <AdminTextarea value={versesRaw} onChange={(e) => setVersesRaw(e.target.value)} rows={14} className="text-base leading-relaxed" />
                {err("verses")}
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Meaning (English)"><AdminTextarea value={d.meaning.en} onChange={(e) => set("meaning", { ...d.meaning, en: e.target.value })} rows={3} /></Field>
              <Field label="Meaning (Hindi)"><AdminTextarea value={d.meaning.hi} onChange={(e) => set("meaning", { ...d.meaning, hi: e.target.value })} rows={3} /></Field>
            </div>
            <Field label="Benefits" hint="One per line"><AdminTextarea value={benefitsRaw} onChange={(e) => setBenefitsRaw(e.target.value)} rows={3} placeholder={"Calms the mind\nRemoves fear"} /></Field>
          </Card>

          <Card className="space-y-4 p-5">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>When to chant</p>
            <Field label="Traditional time" hint="Shown in the app"><AdminInput value={d.bestTime} onChange={(e) => set("bestTime", e.target.value)} placeholder="Mondays, early morning" maxLength={160} /></Field>
            <Field label="Days (today's mantra)" hint="The app shows a featured mantra for today's weekday">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((label, i) => {
                  const on = d.days.includes(i);
                  return <button key={label} type="button" onClick={() => set("days", on ? d.days.filter((x) => x !== i) : [...d.days, i].sort())} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "var(--a-gold-soft)" : undefined, color: "var(--a-fg)" }}>{label}</button>;
                })}
              </div>
            </Field>
            <Field label="Planets (graha)" hint="Used later for 'mantra for your planet' from the kundli">
              <div className="flex flex-wrap gap-2">
                {PLANETS.map((p) => {
                  const on = d.planets.includes(p);
                  return <button key={p} type="button" onClick={() => set("planets", on ? d.planets.filter((x) => x !== p) : [...d.planets, p])} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border)", background: on ? "var(--a-gold-soft)" : undefined, color: "var(--a-fg)" }}>{p}</button>;
                })}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Festivals" hint="Comma separated. Festival calendar links here (ekadashi, shivratri)"><AdminInput value={d.festivals.join(", ")} onChange={(e) => set("festivals", toList(e.target.value))} /></Field>
              <Field label="Tags" hint="Comma separated, for search"><AdminInput value={d.tags.join(", ")} onChange={(e) => set("tags", toList(e.target.value))} /></Field>
              {isMantra && (
                <>
                  <Field label="Suggested count">
                    <AdminSelect value={String(d.defaultCount)} onChange={(e) => set("defaultCount", Number(e.target.value))}>{COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</AdminSelect>
                  </Field>
                  <Field label="One recitation (seconds)" hint="Used for the jaap timer when there is no audio">
                    <AdminInput inputMode="numeric" value={String(d.recitationSec)} onChange={(e) => set("recitationSec", Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))} />
                    {err("recitationSec")}
                  </Field>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><Music size={15} /> Audio</p>
            {d.audio ? (
              <div className="space-y-2">
                <audio src={d.audio.url} controls className="w-full" preload="metadata" />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Length (sec)"><AdminInput inputMode="decimal" value={String(d.audio.durationSec)} onChange={(e) => set("audio", { ...d.audio!, durationSec: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></Field>
                  <Field label="Size"><AdminInput value={d.audio.bytes ? `${(d.audio.bytes / 1048576).toFixed(1)} MB` : "-"} readOnly /></Field>
                </div>
                <Field label="Singer / artist" hint="Shown in the app"><AdminInput value={d.audio.artist ?? ""} onChange={(e) => set("audio", { ...d.audio!, artist: e.target.value })} maxLength={120} /></Field>
                <Field label="Rights note" hint="Team only. Who owns the recording, licence"><AdminInput value={d.audio.license ?? ""} onChange={(e) => set("audio", { ...d.audio!, license: e.target.value })} maxLength={300} /></Field>
                <div className="flex gap-2">
                  <AdminButton variant="outline" loading={uploading === "audio"} onClick={() => audioRef.current?.click()}><Upload size={14} /> Replace</AdminButton>
                  <AdminButton variant="ghost" onClick={() => set("audio", null)}><X size={14} /> Remove</AdminButton>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: "var(--a-muted)" }}>MP3 or M4A, up to 50 MB. 128 kbps MP3 is enough for chanting and loads fast on phones. Without audio, the app offers the jaap timer and mala (tap) counting.</p>
                <AdminButton loading={uploading === "audio"} onClick={() => audioRef.current?.click()}><Upload size={14} /> Upload audio</AdminButton>
              </div>
            )}
            <input ref={audioRef} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, "audio"); e.target.value = ""; }} />
          </Card>

          <Card className="space-y-3 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><ImageIcon size={15} /> Cover image (optional)</p>
            {d.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.image} alt="" className="aspect-square w-full rounded-lg object-cover" />
            ) : <p className="text-xs" style={{ color: "var(--a-muted)" }}>Square works best. Resized to 1600 px automatically.</p>}
            <div className="flex gap-2">
              <AdminButton variant="outline" loading={uploading === "image"} onClick={() => imageRef.current?.click()}><Upload size={14} /> {d.image ? "Replace" : "Upload image"}</AdminButton>
              {d.image && <AdminButton variant="ghost" onClick={() => set("image", null)}><X size={14} /> Remove</AdminButton>}
            </div>
            <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, "image"); e.target.value = ""; }} />
          </Card>

          <Card className="space-y-2 p-5">
            <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>In the app</p>
            <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(160deg,#3B1466,#1B0A33)" }}>
              <p className="text-xs font-semibold" style={{ color: "#F2D18A" }}>{d.deity || "Deity"}</p>
              <p className="mt-1 text-lg font-semibold text-white">{d.devanagari || d.titleHi || d.title || "Text"}</p>
              {d.roman && <p className="mt-1 text-xs text-white/80">{d.roman.slice(0, 140)}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={d.status === "published" ? "green" : "muted"}>{d.status === "published" ? "Published" : "Draft"}</Badge>
              <Badge tone="muted">{KIND_LABEL[d.kind]}</Badge>
              {d.audio ? <Badge tone="gold">Audio {mmss(d.audio.durationSec)}</Badge> : <Badge tone="muted">No audio</Badge>}
              {!isMantra && <Badge tone="muted">{verses.length} blocks</Badge>}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} danger confirmLabel="Delete" title={`Delete "${d.title}"?`}
        message="It disappears from the app at once. Customers' jaap history stays." onConfirm={async () => { setConfirmDelete(false); await remove(); }} />
    </div>
  );
}
