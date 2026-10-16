"use client";

/**
 * ServiceBookingForm — the paid booking flow for a priced astrology service.
 *
 * Flow (login required, mirrors checkout):
 *   1. collect the intake (name/phone/DOB/birth time/place/question) + optional
 *      preferred date,
 *   2. create a PENDING booking + Razorpay order on the server,
 *   3. open Razorpay Checkout,
 *   4. verify the signature server-side → booking is confirmed + paid.
 *
 * Logged-out users see a sign-in prompt (redirect back to this service).
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Lock, ArrowRight, Loader2, CalendarClock } from "lucide-react";
import type { AstroService } from "@/types";
import { useCommerce } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { shopApi } from "@/lib/shop-api";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

export function ServiceBookingForm({ service }: { service: AstroService }) {
  const { user, authReady } = useCommerce();
  const { format } = useCurrency();
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ bookingNumber: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: user?.name ?? "",
    phone: user?.phone ?? "",
    dob: "",
    birthTime: "",
    birthPlace: "",
    message: "",
    preferredAt: "",
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleBook = async () => {
    if (submitting) return;
    setError("");
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError("Please enter your name and phone.");
      return;
    }
    setSubmitting(true);

    const init = await shopApi.bookings.createRazorpay({
      serviceId: service.id,
      intake: {
        fullName: form.fullName,
        phone: form.phone,
        dob: form.dob,
        birthTime: form.birthTime,
        birthPlace: form.birthPlace,
        message: form.message,
      },
      preferredAt: form.preferredAt ? new Date(form.preferredAt).toISOString() : undefined,
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
          prefill: { name: form.fullName, email: user?.email || "", contact: form.phone },
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
              setError(
                "Payment received but confirmation is pending — it'll be reconciled shortly. Ref: " +
                  d.bookingNumber,
              );
              return;
            }
            setDone({ bookingNumber: verify.data.bookingNumber });
            toast("Booking confirmed!", "success");
          },
          onDismiss: () => {
            setSubmitting(false);
            setError("Payment was cancelled. Your booking is saved as pending — you can retry.");
          },
        },
      );
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    }
  };

  // ── success ──
  if (done) {
    return (
      <div
        id="book"
        className="mt-6 overflow-hidden rounded-[2rem] border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-6 sm:p-8"
      >
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
            <CheckCircle2 size={30} />
          </span>
          <h3 className="mt-5 text-2xl font-semibold text-foreground">Booking Confirmed!</h3>
          <p className="mt-1 text-sm text-muted">
            Ref: <span className="font-semibold text-gold-600">{done.bookingNumber}</span>
          </p>
          <p className="mt-2 max-w-sm text-muted">
            Thank you. Our astrologer will reach out to schedule your{" "}
            <span className="font-medium text-foreground">{service.title}</span>.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/account?tab=bookings">
              <Button variant="gold" size="lg">
                View My Bookings <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/services">
              <Button variant="ghost" size="lg">
                Browse Services
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── login gate ──
  if (authReady && !user) {
    return (
      <div
        id="book"
        className="mt-6 overflow-hidden rounded-[2rem] border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-6 text-center sm:p-8"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-400/12 text-gold-600">
          <Lock size={26} />
        </span>
        <h3 className="mt-4 text-xl font-semibold text-foreground">Sign in to book</h3>
        <p className="mt-1 text-sm text-muted">
          Book securely and track this consultation from your account.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/account?redirect=/services/${service.slug}`}>
            <Button variant="gold" size="lg">
              Sign In <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href={`/account?redirect=/services/${service.slug}&tab=signup`}>
            <Button variant="outline" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── booking form ──
  return (
    <div
      id="book"
      className="mt-6 overflow-hidden rounded-[2rem] border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-6 sm:p-8"
    >
      <AnimatePresence mode="wait">
        <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gold-500" />
              <h2 className="text-xl font-semibold text-foreground">Book this Consultation</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Amount</p>
              <p className="text-xl font-bold text-foreground">{format(service.priceFrom)}</p>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">
            Share your birth details so our astrologer can prepare before your session.
          </p>

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Full Name" required>
                <input className={inputClass} value={form.fullName} onChange={set("fullName")} placeholder="Your name" />
              </Labeled>
              <Labeled label="Phone / WhatsApp" required>
                <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="+91 00000 00000" />
              </Labeled>
              <Labeled label="Date of Birth">
                <input type="date" className={inputClass} value={form.dob} onChange={set("dob")} />
              </Labeled>
              <Labeled label="Time of Birth">
                <input type="time" className={inputClass} value={form.birthTime} onChange={set("birthTime")} />
              </Labeled>
              <Labeled label="Place of Birth">
                <input className={inputClass} value={form.birthPlace} onChange={set("birthPlace")} placeholder="City, Country" />
              </Labeled>
              <Labeled label="Preferred date (optional)">
                <input type="datetime-local" className={inputClass} value={form.preferredAt} onChange={set("preferredAt")} />
              </Labeled>
            </div>

            <Labeled label="Your Question / Concern">
              <textarea
                rows={3}
                className={cn(inputClass, "resize-none")}
                value={form.message}
                onChange={set("message")}
                placeholder="Tell us what you'd like guidance on…"
              />
            </Labeled>

            {error && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button type="button" variant="gold" size="lg" onClick={handleBook} disabled={submitting || !authReady}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    Book & Pay {format(service.priceFrom)}
                  </>
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

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-mystic"> *</span>}
      </span>
      {children}
    </label>
  );
}
