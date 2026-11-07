"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { partnerApi } from "@/lib/astrologer-api";
import { CATEGORY_OPTIONS, EXPERTISE_OPTIONS, LANGUAGE_OPTIONS } from "@/modules/astrologers/astrologer.types";
import { PHONE_RE } from "@/modules/astrologers/astrologer.schema";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Field, ProgressBar } from "@/app/admin/_components";
import { AuthFrame, FormError, fieldErrors } from "../_components/auth-frame";
import { ChipSelect } from "../_components/chips";

const STEPS = ["Account", "About you", "Skills", "Rates"] as const;

interface Form {
  displayName: string; legalName: string; email: string; phone: string; password: string; confirm: string;
  gender: "" | "male" | "female" | "other"; city: string; state: string; experienceYears: string; education: string; certifications: string; shortBio: string; bio: string;
  languages: string[]; expertise: string[]; categories: string[];
  chat: string; call: string; video: string; acceptTerms: boolean;
}
const EMPTY: Form = {
  displayName: "", legalName: "", email: "", phone: "", password: "", confirm: "",
  gender: "", city: "", state: "", experienceYears: "", education: "", certifications: "", shortBio: "", bio: "",
  languages: [], expertise: [], categories: [], chat: "15", call: "20", video: "0", acceptTerms: false,
};

/** Map server field paths to the step they live on, so errors jump to the right step. */
const FIELD_STEP: Record<string, number> = {
  displayName: 0, legalName: 0, email: 0, phone: 0, password: 0,
  gender: 1, city: 1, state: 1, experienceYears: 1, education: 1, certifications: 1, shortBio: 1, bio: 1,
  languages: 2, expertise: 2, categories: 2, "rates.chat": 3, "rates.call": 3, "rates.video": 3, acceptTerms: 3,
};

function stepIssues(step: number, f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (f.displayName.trim().length < 2) e.displayName = "Enter the name customers will see";
    if (f.legalName.trim().length < 2) e.legalName = "Enter your full legal name";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
    if (!PHONE_RE.test(f.phone.trim())) e.phone = "Enter a valid 10-digit mobile number";
    if (f.password.length < 8 || !/[a-zA-Z]/.test(f.password) || !/\d/.test(f.password)) e.password = "At least 8 characters with a letter and a number";
    if (f.confirm !== f.password) e.confirm = "Passwords do not match";
  }
  if (step === 1) {
    const y = Number(f.experienceYears);
    if (f.experienceYears === "" || !Number.isInteger(y) || y < 0 || y > 80) e.experienceYears = "Enter years of experience (0-80)";
    if (f.shortBio.trim().length < 20) e.shortBio = "Write at least 20 characters";
  }
  if (step === 2) {
    if (!f.languages.length) e.languages = "Pick at least one language";
    if (!f.expertise.length) e.expertise = "Pick at least one skill";
  }
  if (step === 3) {
    if (!(Number(f.chat) > 0)) e["rates.chat"] = "Chat rate is required";
    if (!f.acceptTerms) e.acceptTerms = "Please accept the partner terms";
  }
  return e;
}

export function ApplyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = (k: string) => errors[k] ? <p className="mt-1 text-xs text-rose-600">{errors[k]}</p> : null;
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const next = () => {
    const e = stepIssues(step, f);
    setErrors(e);
    if (!Object.keys(e).length) setStep((s) => s + 1);
  };

  const submit = async () => {
    const e = stepIssues(3, f);
    setErrors(e);
    if (Object.keys(e).length) return;
    setError(null);
    setLoading(true);
    const res = await partnerApi.auth.apply({
      displayName: f.displayName.trim(), legalName: f.legalName.trim(), email: f.email.trim(), phone: f.phone.trim(), password: f.password,
      gender: f.gender || undefined, city: f.city.trim() || undefined, state: f.state.trim() || undefined,
      experienceYears: Number(f.experienceYears), education: f.education.trim() || undefined, certifications: f.certifications.trim() || undefined,
      shortBio: f.shortBio.trim(), bio: f.bio.trim() || undefined,
      languages: f.languages, expertise: f.expertise, categories: f.categories,
      rates: { chat: Number(f.chat) || 0, call: Number(f.call) || 0, video: Number(f.video) || 0 },
      acceptTerms: true,
    });
    setLoading(false);
    if (!res.ok) {
      const fe = fieldErrors(res.details);
      setErrors(fe);
      const first = Object.keys(fe).map((k) => FIELD_STEP[k]).filter((n) => n !== undefined).sort()[0];
      if (first !== undefined) setStep(first);
      setError(res.message);
      return;
    }
    router.replace("/astrologer/kyc?welcome=1");
  };

  return (
    <AuthFrame wide title="Become an Astrounkle astrologer" subtitle="Join our panel of verified astrologers. It takes about 5 minutes."
      footer={<>Already a partner? <Link href="/astrologer/login" className="font-semibold" style={{ color: "var(--a-gold)" }}>Sign in</Link></>}>
      <ol className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-semibold uppercase tracking-wide">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5" style={{ color: i <= step ? "var(--a-gold)" : "var(--a-faint)" }} aria-current={i === step ? "step" : undefined}>
            {i < step ? <CheckCircle2 size={14} /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>}{s}
          </li>
        ))}
      </ol>
      <ProgressBar value={progress} />

      <div className="mt-6 space-y-4">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" hint="Shown to customers, e.g. Acharya Rohan Ji" required><AdminInput value={f.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} />{err("displayName")}</Field>
            <Field label="Full legal name" hint="As on PAN, for payouts" required><AdminInput value={f.legalName} onChange={(e) => set("legalName", e.target.value)} maxLength={120} />{err("legalName")}</Field>
            <Field label="Email" required><AdminInput type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />{err("email")}</Field>
            <Field label="Mobile number" required><AdminInput inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98XXXXXXXX" />{err("phone")}</Field>
            <Field label="Password" hint="8+ characters, a letter and a number" required><AdminInput type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} />{err("password")}</Field>
            <Field label="Confirm password" required><AdminInput type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} />{err("confirm")}</Field>
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gender"><AdminSelect value={f.gender} onChange={(e) => set("gender", e.target.value as Form["gender"])}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></AdminSelect></Field>
            <Field label="Years of experience" required><AdminInput inputMode="numeric" value={f.experienceYears} onChange={(e) => set("experienceYears", e.target.value.replace(/\D/g, "").slice(0, 2))} />{err("experienceYears")}</Field>
            <Field label="City"><AdminInput value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={80} /></Field>
            <Field label="State"><AdminInput value={f.state} onChange={(e) => set("state", e.target.value)} maxLength={80} /></Field>
            <div className="sm:col-span-2"><Field label="Short intro" hint={`${f.shortBio.length}/160 · shown on your card`} required><AdminInput value={f.shortBio} onChange={(e) => set("shortBio", e.target.value.slice(0, 160))} placeholder="Vedic astrologer focused on career and marriage timing" />{err("shortBio")}</Field></div>
            <div className="sm:col-span-2"><Field label="About you" hint="Your approach, training and what customers can expect"><AdminTextarea rows={5} value={f.bio} onChange={(e) => set("bio", e.target.value.slice(0, 3000))} /></Field></div>
            <Field label="Education / training"><AdminInput value={f.education} onChange={(e) => set("education", e.target.value)} maxLength={300} /></Field>
            <Field label="Certifications"><AdminInput value={f.certifications} onChange={(e) => set("certifications", e.target.value)} maxLength={600} /></Field>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <Field label="Languages you consult in" required><ChipSelect label="Languages" options={LANGUAGE_OPTIONS} value={f.languages} onChange={(v) => set("languages", v)} max={10} />{err("languages")}</Field>
            <Field label="Skills" hint="Pick up to 10" required><ChipSelect label="Skills" options={EXPERTISE_OPTIONS} value={f.expertise} onChange={(v) => set("expertise", v)} max={10} />{err("expertise")}</Field>
            <Field label="Topics you help with"><ChipSelect label="Topics" options={CATEGORY_OPTIONS} value={f.categories} onChange={(v) => set("categories", v)} max={12} /></Field>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>Set your price per minute. Use 0 to switch a channel off. You can change these later.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["chat", "call", "video"] as const).map((c) => (
                <Field key={c} label={`${c[0].toUpperCase()}${c.slice(1)} (₹/min)`} required={c === "chat"}>
                  <AdminInput inputMode="numeric" value={f[c]} onChange={(e) => set(c, e.target.value.replace(/\D/g, "").slice(0, 4))} />{err(`rates.${c}`)}
                </Field>
              ))}
            </div>
            <label className="flex items-start gap-3 text-sm" style={{ color: "var(--a-fg)" }}>
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#c9942a]" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} />
              <span>I agree to the partner terms: I will give honest guidance, keep customer details private, not share personal contact details or take payments outside Astrounkle, and I understand the platform keeps a commission on each consultation.</span>
            </label>
            {err("acceptTerms")}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <FormError message={error} />
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? <AdminButton type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={16} />Back</AdminButton> : <span />}
          {step < STEPS.length - 1
            ? <AdminButton type="button" onClick={next}>Continue<ArrowRight size={16} /></AdminButton>
            : <AdminButton type="button" onClick={submit} disabled={loading}>{loading ? "Submitting…" : "Submit application"}</AdminButton>}
        </div>
      </div>
    </AuthFrame>
  );
}
