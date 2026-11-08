"use client";

/**
 * ServiceBookingForm — the paid booking flow for a priced astrology service.
 *
 * Flow (mirrors checkout, login optional):
 *   1. collect the intake (name, phone, email for guests, birth details,
 *      gender, marital status, question) + optional preferred date,
 *   2. create a PENDING booking + Razorpay order on the server,
 *   3. open Razorpay Checkout,
 *   4. verify the signature server-side → booking is confirmed + paid.
 *
 * Each field shows its own error under it; the first invalid field is
 * scrolled into view and focused on submit.
 */

import { useId, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, ArrowRight, Loader2, CalendarClock, AlertCircle } from "lucide-react";
import { SelectField, fieldBase as inputBase, fieldOk as inputOk, fieldBad as inputBad } from "@/components/ui/select-field";
import type { AstroService } from "@/types";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { shopApi } from "@/lib/shop-api";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MARITAL_STATUSES } from "@/modules/bookings/booking.schema";

type Gender = "" | "male" | "female" | "other";
type Marital = "" | (typeof MARITAL_STATUSES)[number];
type Form = {
  fullName: string; email: string; phone: string; dob: string; birthTime: string; birthPlace: string;
  gender: Gender; maritalStatus: Marital; message: string; preferredAt: string;
};
type FieldKey = keyof Form;
type Errors = Partial<Record<FieldKey, string>>;

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;
const MARITAL_OPTIONS: { value: (typeof MARITAL_STATUSES)[number]; label: string }[] = MARITAL_STATUSES.map((m) => ({
  value: m,
  label: m[0].toUpperCase() + m.slice(1),
}));

/** Order fields appear on screen, so we scroll to the first problem. */
const FIELD_ORDER: FieldKey[] = ["fullName", "phone", "email", "dob", "birthTime", "birthPlace", "gender", "maritalStatus", "preferredAt", "message"];


function validate(f: Form, guest: boolean): Errors {
  const e: Errors = {};
  if (f.fullName.trim().length < 2) e.fullName = "Please enter your full name";
  const digits = f.phone.replace(/\D/g, "");
  if (!digits) e.phone = "Please enter your phone number";
  else if (digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number (10 digits or more)";
  if (guest) {
    if (!f.email.trim()) e.email = "Please enter your email for the confirmation";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address";
  }
  if (!f.gender) e.gender = "Please select your gender";
  if (!f.maritalStatus) e.maritalStatus = "Please select your marital status";
  if (f.dob && new Date(f.dob).getTime() > Date.now()) e.dob = "Date of birth can't be in the future";
  if (f.preferredAt && new Date(f.preferredAt).getTime() < Date.now()) e.preferredAt = "Pick a future date and time";
  return e;
}

export function ServiceBookingForm({ service }: { service: AstroService }) {
  const { user, authReady } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();
  const uid = useId();
  const fid = (k: FieldKey) => `${uid}-${k}`;

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ bookingNumber: string } | null>(null);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<Form>({
    fullName: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    dob: "",
    birthTime: "",
    birthPlace: "",
    gender: "",
    maritalStatus: "",
    message: "",
    preferredAt: "",
  });

  const update = <K extends FieldKey>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear that field's error as soon as the user fixes it.
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const set = (k: FieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(k, e.target.value as never);
  const cls = (k: FieldKey, extra?: string) => cn(inputBase, errors[k] ? inputBad : inputOk, extra);
  const aria = (k: FieldKey) => ({
    id: fid(k),
    "aria-invalid": Boolean(errors[k]) || undefined,
    "aria-describedby": errors[k] ? `${fid(k)}-err` : undefined,
  });

  const handleBook = async () => {
    if (submitting) return;
    setError("");
    const found = validate(form, !user);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      const el = document.getElementById(fid(first));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el?.focus({ preventScroll: true }), 250);
      return;
    }
    setSubmitting(true);

    const init = await shopApi.bookings.createRazorpay({
      serviceId: service.id,
      intake: {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        dob: form.dob,
        birthTime: form.birthTime,
        birthPlace: form.birthPlace,
        gender: form.gender,
        maritalStatus: form.maritalStatus,
        message: form.message,
      },
      preferredAt: form.preferredAt ? new Date(form.preferredAt).toISOString() : undefined,
      ...(user ? {} : { customer: { name: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() } }),
    });

    if (!init.ok) {
      setSubmitting(false);
      setError(init.message);
      return;
    }
    const d = init.data;

    try {
      await openRazorpayCheckout(
        {
          key: d.keyId,
          amount: d.amount,
          currency: d.currency,
          name: "Astrounkle",
          description: `${d.serviceTitle} · ${d.bookingNumber}`,
          order_id: d.razorpayOrderId,
          prefill: { name: form.fullName, email: user?.email || form.email, contact: form.phone },
          notes: { bookingNumber: d.bookingNumber },
          theme: { color: "#c9942a" },
        },
        {
          onSuccess: async (r) => {
            const verify = await shopApi.bookings.verifyRazorpay({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            setSubmitting(false);
            if (!verify.ok) {
              setError("Payment received but confirmation is pending. It will be reconciled shortly. Ref: " + d.bookingNumber);
              return;
            }
            setDone({ bookingNumber: verify.data.bookingNumber });
            toast("Booking confirmed", "success");
          },
          onDismiss: () => {
            setSubmitting(false);
            setError("Payment was cancelled. Your booking is saved as pending, you can retry.");
          },
        },
      );
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  const shell =
    "scroll-mt-24 mt-4 overflow-hidden rounded-3xl border border-foreground/10 bg-white p-5 shadow-[0_18px_44px_-30px_rgba(122,69,245,0.35)] sm:p-6";

  // ── success ──
  if (done) {
    return (
      <div id="book" className={shell}>
        <div className="flex flex-col items-center py-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
            <CheckCircle2 size={28} />
          </span>
          <h3 className="mt-4 text-xl font-semibold text-foreground">Booking Confirmed</h3>
          <p className="mt-1 text-sm text-muted">
            Ref: <span className="font-semibold text-gold-600">{done.bookingNumber}</span>
          </p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Thank you. Our astrologer will reach out to schedule your{" "}
            <span className="font-medium text-foreground">{service.title}</span>.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {user ? (
              <Link href="/account?tab=bookings">
                <Button variant="gold" size="md">
                  View My Bookings <ArrowRight size={16} />
                </Button>
              </Link>
            ) : (
              <p className="w-full text-xs text-muted">Confirmation sent to {form.email}</p>
            )}
            <Link href="/services">
              <Button variant="ghost" size="md">
                Browse Services
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── booking form ──
  return (
    <div id="book" className={shell}>
      <AnimatePresence mode="wait">
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gold-500" />
              <h2 className="text-lg font-semibold text-foreground">Book this Consultation</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Amount</p>
              <p className="text-xl font-bold text-foreground">{format(service.priceFrom)}</p>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">
            Share your birth details so our astrologer can prepare before your session.
          </p>

          <div className="mt-4 space-y-3">
            <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Labeled htmlFor={fid("fullName")} label="Full Name" required error={errors.fullName} errorId={`${fid("fullName")}-err`}>
                <input {...aria("fullName")} autoComplete="name" className={cls("fullName")} value={form.fullName} onChange={set("fullName")} placeholder="Your name" />
              </Labeled>
              <Labeled htmlFor={fid("phone")} label="Phone / WhatsApp" required error={errors.phone} errorId={`${fid("phone")}-err`}>
                <input {...aria("phone")} type="tel" autoComplete="tel" inputMode="tel" className={cls("phone")} value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
              </Labeled>
              {!user && (
                <Labeled htmlFor={fid("email")} label="Email" required error={errors.email} errorId={`${fid("email")}-err`}>
                  <input {...aria("email")} type="email" autoComplete="email" className={cls("email")} value={form.email} onChange={set("email")} placeholder="you@example.com" />
                </Labeled>
              )}
              <Labeled htmlFor={fid("dob")} label="Date of Birth" error={errors.dob} errorId={`${fid("dob")}-err`}>
                <input {...aria("dob")} type="date" className={cls("dob")} value={form.dob} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} />
              </Labeled>
              <Labeled htmlFor={fid("birthTime")} label="Time of Birth">
                <input {...aria("birthTime")} type="time" className={cls("birthTime")} value={form.birthTime} onChange={set("birthTime")} />
              </Labeled>
              <Labeled htmlFor={fid("birthPlace")} label="Place of Birth">
                <input {...aria("birthPlace")} className={cls("birthPlace")} value={form.birthPlace} onChange={set("birthPlace")} placeholder="City, Country" />
              </Labeled>
              <Labeled htmlFor={fid("gender")} label="Gender" required error={errors.gender} errorId={`${fid("gender")}-err`} asDiv>
                <SelectField
                  id={fid("gender")}
                  value={form.gender}
                  options={GENDER_OPTIONS}
                  onChange={(v) => update("gender", v as Gender)}
                  invalid={Boolean(errors.gender)}
                  describedBy={errors.gender ? `${fid("gender")}-err` : undefined}
                />
              </Labeled>
              <Labeled htmlFor={fid("maritalStatus")} label="Marital Status" required error={errors.maritalStatus} errorId={`${fid("maritalStatus")}-err`} asDiv>
                <SelectField
                  id={fid("maritalStatus")}
                  value={form.maritalStatus}
                  options={MARITAL_OPTIONS}
                  onChange={(v) => update("maritalStatus", v as Marital)}
                  invalid={Boolean(errors.maritalStatus)}
                  describedBy={errors.maritalStatus ? `${fid("maritalStatus")}-err` : undefined}
                />
              </Labeled>
              <Labeled htmlFor={fid("preferredAt")} label="Preferred date (optional)" error={errors.preferredAt} errorId={`${fid("preferredAt")}-err`}>
                <input {...aria("preferredAt")} type="datetime-local" className={cls("preferredAt")} value={form.preferredAt} onChange={set("preferredAt")} />
              </Labeled>
            </div>

            <Labeled htmlFor={fid("message")} label="Your Question / Concern">
              <textarea
                {...aria("message")}
                rows={2}
                maxLength={2000}
                className={cls("message", "resize-none")}
                value={form.message}
                onChange={set("message")}
                placeholder="Tell us what you'd like guidance on…"
              />
            </Labeled>

            {/* Server / payment problems (field problems show under each field) */}
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button type="button" variant="gold" size="md" onClick={handleBook} disabled={submitting || !authReady}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing…
                  </>
                ) : (
                  <>Book & Pay {format(service.priceFrom)}</>
                )}
              </Button>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarClock size={13} className="text-gold-500" /> Secure payment · instant confirmation
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Field label + inline error
 * ------------------------------------------------------------------ */
function Labeled({
  label,
  htmlFor,
  required,
  error,
  errorId,
  asDiv,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  /** Custom controls (dropdown) must not sit inside a <label>, or clicks double-fire. */
  asDiv?: boolean;
  children: React.ReactNode;
}) {
  const head = (
    <>
      {label}
      {required && <span className="text-rose-mystic"> *</span>}
    </>
  );
  return (
    <div className="block">
      {asDiv ? (
        <span id={`${htmlFor}-label`} className="mb-1 block text-[13px] font-medium text-foreground">{head}</span>
      ) : (
        <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-foreground">{head}</label>
      )}
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600"
          >
            <AlertCircle size={12} className="shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
