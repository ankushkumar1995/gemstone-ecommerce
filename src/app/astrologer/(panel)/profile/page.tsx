"use client";

import { useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import type { AvailabilitySlot, SelfAstrologer } from "@/modules/astrologers/astrologer.types";
import { CATEGORY_OPTIONS, EXPERTISE_OPTIONS, LANGUAGE_OPTIONS } from "@/modules/astrologers/astrologer.types";
import { partnerApi } from "@/lib/astrologer-api";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Avatar, Card, Field, PageHeader, StatsSkeleton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "../../_components/partner-context";
import { ChipSelect } from "../../_components/chips";
import { fieldErrors } from "../../_components/auth-frame";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Draft = Pick<SelfAstrologer, "displayName" | "photo" | "shortBio" | "bio" | "gender" | "city" | "state" | "experienceYears" | "education" | "certifications" | "languages" | "expertise" | "categories" | "rates" | "availability">;

const pick = (a: SelfAstrologer): Draft => ({
  displayName: a.displayName, photo: a.photo ?? "", shortBio: a.shortBio ?? "", bio: a.bio ?? "", gender: a.gender, city: a.city ?? "", state: a.state ?? "",
  experienceYears: a.experienceYears, education: a.education ?? "", certifications: a.certifications ?? "",
  languages: a.languages, expertise: a.expertise, categories: a.categories, rates: { ...a.rates }, availability: a.availability.map((s) => ({ ...s })),
});

export default function ProfilePage() {
  const { me, setMe } = usePartner();
  const { toast } = useAdminToast();
  // Local edits; until the first edit the form shows the saved profile.
  const [draft, setD] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const d = draft ?? (me ? pick(me) : null);
  if (!me || !d) return <StatsSkeleton count={3} />;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...(p ?? pick(me)), [k]: v }));
  const err = (k: string) => errors[k] ? <p className="mt-1 text-xs text-rose-600">{errors[k]}</p> : null;
  const reviewed = me.status === "approved";

  const upload = async (file: File) => {
    setUploading(true);
    const res = await partnerApi.uploadPhoto(file);
    setUploading(false);
    if (res.ok) { set("photo", res.data.url); toast(reviewed ? "Photo uploaded. Save to send it for review." : "Photo uploaded. Save to apply.", "info"); }
    else toast(res.message, "error");
  };

  const addSlot = (day: number) => set("availability", [...d.availability, { day: day as AvailabilitySlot["day"], start: "10:00", end: "18:00" }]);
  const updSlot = (i: number, patch: Partial<AvailabilitySlot>) => set("availability", d.availability.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const delSlot = (i: number) => set("availability", d.availability.filter((_, k) => k !== i));

  const save = async () => {
    const base = pick(me);
    const changed: Record<string, unknown> = {};
    (Object.keys(d) as (keyof Draft)[]).forEach((k) => { if (JSON.stringify(d[k]) !== JSON.stringify(base[k])) changed[k] = d[k] === "" ? undefined : d[k]; });
    if (!Object.keys(changed).length) { toast("Nothing to save", "info"); return; }
    setSaving(true);
    setErrors({});
    const res = await partnerApi.updateProfile(changed);
    setSaving(false);
    if (!res.ok) { setErrors(fieldErrors(res.details)); toast(res.message, "error"); return; }
    setMe(res.data);
    setD(pick(res.data));
    toast(res.data.pendingChanges ? "Saved. Name/photo/bio changes are sent for review." : "Profile saved", "success");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & rates" subtitle={reviewed ? "Changes to your name, photo and bio are checked by our team before they go live." : "This is what customers will see."}
        action={<AdminButton onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</AdminButton>} />

      {me.pendingChanges && (
        <Card className="p-4 text-sm" style={{ color: "var(--a-gold)" }}>Waiting for review: {Object.keys(me.pendingChanges).filter((k) => k !== "submittedAt").join(", ")}. Customers still see your previous version.</Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={d.displayName} src={d.photo || undefined} size={88} />
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            <AdminButton variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}><Camera size={16} />{uploading ? "Uploading…" : "Change photo"}</AdminButton>
            <p className="text-xs" style={{ color: "var(--a-muted)" }}>A clear, friendly face photo. JPG/PNG/WEBP, up to 4 MB.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Display name"><AdminInput value={d.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} />{err("displayName")}</Field>
          <Field label="Years of experience"><AdminInput inputMode="numeric" value={String(d.experienceYears)} onChange={(e) => set("experienceYears", Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0)} />{err("experienceYears")}</Field>
          <div className="sm:col-span-2"><Field label="Short intro" hint={`${(d.shortBio ?? "").length}/160`}><AdminInput value={d.shortBio} onChange={(e) => set("shortBio", e.target.value.slice(0, 160))} />{err("shortBio")}</Field></div>
          <div className="sm:col-span-2"><Field label="About you"><AdminTextarea rows={6} value={d.bio} onChange={(e) => set("bio", e.target.value.slice(0, 3000))} />{err("bio")}</Field></div>
          <Field label="Gender"><AdminSelect value={d.gender ?? ""} onChange={(e) => set("gender", (e.target.value || undefined) as Draft["gender"])}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></AdminSelect></Field>
          <Field label="City"><AdminInput value={d.city} onChange={(e) => set("city", e.target.value)} maxLength={80} /></Field>
          <Field label="Education / training"><AdminInput value={d.education} onChange={(e) => set("education", e.target.value)} maxLength={300} /></Field>
          <Field label="Certifications"><AdminInput value={d.certifications} onChange={(e) => set("certifications", e.target.value)} maxLength={600} /></Field>
        </div>
      </Card>

      <Card className="space-y-5 p-5">
        <Field label="Languages"><ChipSelect label="Languages" options={LANGUAGE_OPTIONS} value={d.languages} onChange={(v) => set("languages", v)} max={10} />{err("languages")}</Field>
        <Field label="Skills"><ChipSelect label="Skills" options={EXPERTISE_OPTIONS} value={d.expertise} onChange={(v) => set("expertise", v)} max={10} />{err("expertise")}</Field>
        <Field label="Topics"><ChipSelect label="Topics" options={CATEGORY_OPTIONS} value={d.categories} onChange={(v) => set("categories", v)} max={12} /></Field>
      </Card>

      <Card className="p-5">
        <p className="mb-1 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Rates (₹ per minute)</p>
        <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Up to ₹{me.effectiveMaxRate}/min. Use 0 to switch a channel off. New rates apply to new consultations only.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["chat", "call", "video"] as const).map((c) => (
            <Field key={c} label={c[0].toUpperCase() + c.slice(1)}>
              <AdminInput inputMode="numeric" value={String(d.rates[c])} onChange={(e) => set("rates", { ...d.rates, [c]: Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 0 })} />{err(`rates.${c}`)}
            </Field>
          ))}
        </div>
        {err("rates")}
      </Card>

      <Card className="p-5">
        <p className="mb-1 text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Usual availability (India time)</p>
        <p className="mb-4 text-xs" style={{ color: "var(--a-muted)" }}>Shown on your profile so customers know when to find you. Going online is what actually makes you reachable.</p>
        <div className="space-y-3">
          {DAYS.map((label, day) => {
            const rows = d.availability.map((s, i) => ({ s, i })).filter(({ s }) => s.day === day);
            return (
              <div key={label} className="flex flex-wrap items-start gap-3 border-b pb-3 last:border-0" style={{ borderColor: "var(--a-border)" }}>
                <span className="w-12 pt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>{label}</span>
                <div className="flex flex-1 flex-col gap-2">
                  {rows.length === 0 && <span className="pt-2 text-sm" style={{ color: "var(--a-faint)" }}>Not available</span>}
                  {rows.map(({ s, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <AdminInput type="time" value={s.start} onChange={(e) => updSlot(i, { start: e.target.value })} className="w-32" aria-label={`${label} start`} />
                      <span style={{ color: "var(--a-muted)" }}>to</span>
                      <AdminInput type="time" value={s.end} onChange={(e) => updSlot(i, { end: e.target.value })} className="w-32" aria-label={`${label} end`} />
                      <button type="button" onClick={() => delSlot(i)} aria-label="Remove time" className="rounded-md p-2 text-rose-600 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => addSlot(day)} className="mt-1 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-black/[0.04]" style={{ color: "var(--a-gold)" }}><Plus size={14} />Add</button>
              </div>
            );
          })}
        </div>
        {Object.keys(errors).some((k) => k.startsWith("availability")) && <p className="mt-2 text-xs text-rose-600">Check your times: the end must be after the start.</p>}
      </Card>
    </div>
  );
}
