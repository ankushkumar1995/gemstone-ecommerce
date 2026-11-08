"use client";

/**
 * Consultation request.
 *
 *   <ConsultationForm />   the form on its own (used on /consultation)
 *   <ConsultationModal />  the same form in a dialog, for a chosen astrologer
 *
 * Saves a lead (source "consultation") with the person's details, birth
 * details, concern and preferred mode; the team calls back to schedule.
 * Errors show under each field and the first one is scrolled to.
 *
 * Dialog: rendered in a portal, locks page scroll, focuses the first field,
 * Escape / backdrop / close button closes it, Tab stays inside, focus
 * returns to the button that opened it.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Star, BadgeCheck, AlertCircle, CheckCircle2, Loader2, Phone, MessageCircle, Video, Lock, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { useCommerce } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { SelectField, fieldBase, fieldOk, fieldBad } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

export type ConsultAstrologer = { name: string; role: string; image: string; rating: number; years: number };

type Gender = "" | "male" | "female" | "other";
type Marital = "" | "single" | "married" | "divorced" | "widowed" | "separated";
type Mode = "call" | "chat" | "video";
type Form = {
  fullName: string; phone: string; email: string; dob: string; birthTime: string; birthPlace: string;
  gender: Gender; maritalStatus: Marital; concern: string; mode: Mode; message: string;
};
type Key = keyof Form;
type Errors = Partial<Record<Key, string>>;

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;
const MARITAL = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
] as const;
export const CONSULT_CONCERNS = ["Career", "Marriage", "Love", "Health", "Finance", "Education", "Other"];
const MODES: { value: Mode; label: string; icon: typeof Phone }[] = [
  { value: "call", label: "Call", icon: Phone },
  { value: "chat", label: "Chat", icon: MessageCircle },
  { value: "video", label: "Video", icon: Video },
];
const ORDER: Key[] = ["fullName", "phone", "email", "dob", "birthTime", "birthPlace", "gender", "maritalStatus", "concern", "message"];

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.fullName.trim().length < 2) e.fullName = "Please enter your full name";
  const digits = f.phone.replace(/\D/g, "");
  if (!digits) e.phone = "Please enter your phone number";
  else if (digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number (10 digits or more)";
  if (!f.email.trim()) e.email = "Please enter your email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!f.dob) e.dob = "Please enter your date of birth";
  else if (new Date(f.dob).getTime() > Date.now()) e.dob = "Date of birth can't be in the future";
  if (f.birthPlace.trim().length < 2) e.birthPlace = "Please enter your place of birth";
  if (!f.gender) e.gender = "Please select your gender";
  if (!f.maritalStatus) e.maritalStatus = "Please select your marital status";
  if (!f.concern) e.concern = "Pick what you want guidance on";
  return e;
}

/* ================================================================== *
 * Form
 * ================================================================== */
export function ConsultationForm({
  astrologer,
  layout = "page",
  onDone,
}: {
  /** When set, the request is for this astrologer. */
  astrologer?: ConsultAstrologer | null;
  /** "modal": scrolls inside and keeps the button pinned at the bottom. */
  layout?: "page" | "modal";
  /** Called by the "Done" button after sending (modal closes itself). */
  onDone?: () => void;
}) {
  const { user } = useCommerce();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const uid = useId();
  const fid = (k: Key) => `${uid}-${k}`;
  const modal = layout === "modal";

  const empty = (): Form => ({
    fullName: user?.name ?? "", phone: user?.phone ?? "", email: user?.email ?? "",
    dob: "", birthTime: "", birthPlace: "", gender: "", maritalStatus: "", concern: "", mode: "call", message: "",
  });
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update = <K extends Key>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(k, e.target.value as never);
  const cls = (k: Key, extra?: string) => cn(fieldBase, errors[k] ? fieldBad : fieldOk, extra);
  const aria = (k: Key) => ({ id: fid(k), "aria-invalid": Boolean(errors[k]) || undefined, "aria-describedby": errors[k] ? `${fid(k)}-err` : undefined });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setServerError("");
    const found = validate(form);
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      const el = document.getElementById(first === "concern" ? `${fid("concern")}-0` : fid(first));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el?.focus({ preventScroll: true }), 200);
      return;
    }
    setSending(true);
    const res = await api.leads.create({
      source: "consultation",
      name: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      topic: `${form.concern} · ${MODES.find((m) => m.value === form.mode)?.label} consultation`,
      message: form.message.trim() || undefined,
      birth: { date: form.dob, time: form.birthTime || undefined, place: form.birthPlace.trim() },
      gender: form.gender || undefined,
      maritalStatus: form.maritalStatus || undefined,
      astrologer: astrologer?.name,
    });
    setSending(false);
    if (!res.ok) { setServerError(res.message); return; }
    setSent(true);
    toast("Request received. We'll call you shortly.", "success");
  };

  if (sent) {
    return (
      <div className={cn("flex flex-col items-center text-center", modal ? "px-6 py-10" : "py-8")}>
        <motion.span initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-lg">
          <CheckCircle2 size={30} />
        </motion.span>
        <h3 className="mt-4 text-xl font-semibold text-foreground">Request received</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted">
          Thank you, {form.fullName.split(" ")[0]}. Our team will call you on <span className="font-medium text-foreground">{form.phone}</span> shortly to schedule your session{astrologer ? ` with ${astrologer.name}` : ""}.
        </p>
        {modal ? (
          <Button variant="gold" size="md" className="mt-5" onClick={onDone}>Done</Button>
        ) : (
          <Button variant="outline" size="md" className="mt-5" onClick={() => { setForm(empty()); setErrors({}); setSent(false); }}>Send another request</Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn(modal && "flex min-h-0 flex-1 flex-col")}>
      <div className={cn("space-y-3", modal && "min-h-0 flex-1 overflow-y-auto px-5 py-4")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid("fullName")} label="Full Name" required error={errors.fullName}>
            <input {...aria("fullName")} autoComplete="name" className={cls("fullName")} value={form.fullName} onChange={set("fullName")} placeholder="Your name" />
          </Field>
          <Field id={fid("phone")} label="Phone / WhatsApp" required error={errors.phone}>
            <input {...aria("phone")} type="tel" inputMode="tel" autoComplete="tel" className={cls("phone")} value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
          </Field>
          <Field id={fid("email")} label="Email" required error={errors.email}>
            <input {...aria("email")} type="email" autoComplete="email" className={cls("email")} value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </Field>
          <Field id={fid("dob")} label="Date of Birth" required error={errors.dob}>
            <input {...aria("dob")} type="date" max={new Date().toISOString().slice(0, 10)} className={cls("dob")} value={form.dob} onChange={set("dob")} />
          </Field>
          <Field id={fid("birthTime")} label="Time of Birth" hint="Leave empty if you don't know">
            <input {...aria("birthTime")} type="time" className={cls("birthTime")} value={form.birthTime} onChange={set("birthTime")} />
          </Field>
          <Field id={fid("birthPlace")} label="Place of Birth" required error={errors.birthPlace}>
            <input {...aria("birthPlace")} className={cls("birthPlace")} value={form.birthPlace} onChange={set("birthPlace")} placeholder="City, State" />
          </Field>
          <Field id={fid("gender")} label="Gender" required error={errors.gender} custom>
            <SelectField id={fid("gender")} value={form.gender} options={GENDERS} onChange={(v) => update("gender", v as Gender)} invalid={Boolean(errors.gender)} describedBy={errors.gender ? `${fid("gender")}-err` : undefined} />
          </Field>
          <Field id={fid("maritalStatus")} label="Marital Status" required error={errors.maritalStatus} custom>
            <SelectField id={fid("maritalStatus")} value={form.maritalStatus} options={MARITAL} onChange={(v) => update("maritalStatus", v as Marital)} invalid={Boolean(errors.maritalStatus)} describedBy={errors.maritalStatus ? `${fid("maritalStatus")}-err` : undefined} />
          </Field>
        </div>

        {/* concern chips */}
        <Field id={fid("concern")} label="What do you need guidance on?" required error={errors.concern} custom>
          <div role="radiogroup" aria-labelledby={`${fid("concern")}-label`} aria-describedby={errors.concern ? `${fid("concern")}-err` : undefined} className="flex flex-wrap gap-2">
            {CONSULT_CONCERNS.map((c, i) => {
              const on = form.concern === c;
              return (
                <button key={c} id={`${fid("concern")}-${i}`} type="button" role="radio" aria-checked={on} onClick={() => update("concern", c)}
                  className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
                    on ? "border-transparent bg-gradient-to-r from-gold-400 to-gold-500 text-white shadow-[0_8px_18px_-10px_rgba(201,148,42,0.8)]"
                      : errors.concern ? "border-rose-300 text-foreground hover:border-rose-400" : "border-foreground/12 text-foreground hover:border-gold-400/60")}>
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        {/* mode */}
        <Field id={fid("mode")} label="Preferred consultation" custom>
          <div role="radiogroup" aria-labelledby={`${fid("mode")}-label`} className="grid grid-cols-3 gap-2">
            {MODES.map((m) => {
              const on = form.mode === m.value;
              return (
                <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => update("mode", m.value)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
                    on ? "border-gold-400 bg-gold-400/10 text-gold-700" : "border-foreground/12 text-foreground hover:border-gold-400/50")}>
                  <m.icon size={15} /> {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field id={fid("message")} label="Your question (optional)">
          <textarea {...aria("message")} rows={2} maxLength={2000} className={cls("message", "resize-none")} value={form.message} onChange={set("message")} placeholder="Tell the astrologer what's on your mind…" />
        </Field>

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {serverError}
          </p>
        )}
      </div>

      {/* footer CTA (pinned in the dialog) */}
      <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", modal ? "border-t border-foreground/8 bg-white px-5 py-3.5" : "mt-4 border-t border-foreground/8 pt-4")}>
        <p className="flex items-center gap-1.5 text-xs text-muted"><Lock size={12} className="text-gold-500" /> Your details stay private and are only shared with your astrologer.</p>
        <Button type="submit" variant="gold" size="lg" disabled={sending} className="shrink-0 gap-1.5">
          {sending ? (<><Loader2 size={16} className="animate-spin" /> Sending…</>) : (<>Request Consultation <ArrowRight size={16} /></>)}
        </Button>
      </div>
    </form>
  );
}

/* ================================================================== *
 * Dialog
 * ================================================================== */
export function ConsultationModal({ astrologer, onClose }: { astrologer: ConsultAstrologer | null; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  // Portal target exists only in the browser.
  useEffect(() => { const t = window.setTimeout(() => setMounted(true), 0); return () => window.clearTimeout(t); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>{astrologer && <Dialog key={astrologer.name} astrologer={astrologer} onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}

function Dialog({ astrologer, onClose }: { astrologer: ConsultAstrologer; onClose: () => void }) {
  const reduce = useReducedMotion();
  const uid = useId();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = `${uid}-title`;

  // Scroll lock, focus in, focus back, Escape and Tab trap.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("input, button[role=combobox]")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div aria-hidden onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1a1230]/60 backdrop-blur-sm" />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_40px_100px_-30px_rgba(20,10,50,0.6)] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="relative flex items-center gap-3 border-b border-foreground/8 bg-gradient-to-r from-royal-500/[0.07] via-white to-gold-400/[0.08] px-5 py-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-2 ring-gold-400/50">
            <Image src={astrologer.image} alt="" fill sizes="56px" className="object-cover object-top" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-600">Book a consultation with</p>
            <h2 id={titleId} className="flex items-center gap-1 truncate text-lg font-semibold text-foreground">
              {astrologer.name} <BadgeCheck size={16} className="shrink-0 text-royal-500" aria-label="Verified" />
            </h2>
            <p className="flex items-center gap-2 truncate text-xs text-muted">
              {astrologer.role}
              <span className="flex items-center gap-0.5 font-semibold text-foreground"><Star size={12} className="fill-gold-500 text-gold-500" />{astrologer.rating.toFixed(1)}</span>
              <span>· {astrologer.years}+ yrs</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60">
            <X size={18} />
          </button>
        </div>

        <ConsultationForm astrologer={astrologer} layout="modal" onDone={onClose} />
      </motion.div>
    </div>
  );
}

function Field({ id, label, required, hint, error, custom, children }: { id: string; label: string; required?: boolean; hint?: string; error?: string; custom?: boolean; children: React.ReactNode }) {
  const head = (<>{label}{required && <span className="text-rose-mystic"> *</span>}</>);
  return (
    <div>
      {custom ? (
        <span id={`${id}-label`} className="mb-1 block text-[13px] font-medium text-foreground">{head}</span>
      ) : (
        <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-foreground">{head}</label>
      )}
      {children}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p key="e" id={`${id}-err`} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
            <AlertCircle size={12} className="shrink-0" /> {error}
          </motion.p>
        ) : hint ? (
          <p key="h" className="mt-1 text-[11px] text-muted">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
