"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  Gift,
  ShieldCheck,
  Clock,
  Star,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

const perks = [
  {
    icon: Gift,
    title: "100% Free Session",
    desc: "A no-obligation call — no payment, no pressure.",
  },
  {
    icon: Star,
    title: "Verified Astrologers",
    desc: "15+ years of Vedic experience, 25,000+ consultations.",
  },
  {
    icon: ShieldCheck,
    title: "Private & Confidential",
    desc: "Your birth details stay safe and are never shared.",
  },
  {
    icon: Clock,
    title: "Quick Callback",
    desc: "We reach out within 24 hours to schedule your call.",
  },
];

export function FreeConsultation() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;

    if (!data.name?.trim() || !data.phone?.trim()) {
      setError("Please enter your name and phone number.");
      return;
    }

    setSubmitting(true);
    const res = await api.leads.create({
      source: "service",
      name: data.name,
      email: data.email || "",
      phone: data.phone,
      topic: "Free Astrology Consultation",
      message: data.message,
      birth: {
        date: data.dob,
        time: data.birthTime,
        place: data.birthPlace,
      },
    });
    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      form.reset();
      toast("Request received! We'll call you soon.", "success");
    } else {
      setError(res.message);
    }
  };

  return (
    <section
      id="free-consultation"
      className="relative scroll-mt-24 overflow-hidden py-20"
    >
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-royal-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl"
      />

      <div className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        <SectionHeader
          eyebrow="Talk to an Astrologer"
          title={
            <>
              Your First Consultation is{" "}
              <span className="text-gradient-gold">Absolutely Free</span>
            </>
          }
          description="Book a no-obligation call with our master Vedic astrologer. Share your birth details and get personalised guidance on your kundli, gemstones and remedies."
          className="mb-14"
        />

        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* ============================================================ *
           *  LEFT — pitch + perks
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col justify-center rounded-[2rem] border border-foreground/10 bg-gradient-to-br from-[#1a1230] via-royal-700 to-[#2a1a4d] p-8 sm:p-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:22px_22px]"
            />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-200 backdrop-blur-sm">
                <Gift size={13} />
                Free Expert Guidance
              </span>

              <h3 className="mt-5 font-display text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] sm:text-4xl">
                Guidance That Aligns
                <span className="block text-gold-300">With Your Stars</span>
              </h3>

              <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
                Share your details and our Vedic astrologer will call you back for
                a free, personalised session — covering your kundli, the right
                gemstone, and remedies that actually work.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {perks.map((p) => (
                  <motion.div
                    key={p.title}
                    whileHover={{ y: -4 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:border-gold-400/40"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400/20 to-royal-500/20 text-gold-300">
                      <p.icon size={18} />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-white">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/65">
                      {p.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ============================================================ *
           *  RIGHT — form card
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.06] to-nebula p-8 sm:p-10"
          >
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-royal-500/10 blur-3xl" />

            <AnimatePresence mode="wait">
              {sent ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex min-h-[26rem] flex-col items-center justify-center text-center"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_18px_40px_-16px_rgba(201,148,42,0.7)]"
                  >
                    <CheckCircle2 size={38} />
                  </motion.span>
                  <h3 className="mt-6 font-display text-2xl font-semibold text-foreground">
                    Request Received!
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    Thank you. Our astrologer will call you within 24 hours to
                    schedule your free consultation. Keep your phone handy.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="mt-6 text-sm font-semibold text-gold-600 underline-offset-4 hover:underline"
                  >
                    Submit another request
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="relative"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-gold-500" />
                    <h3 className="text-xl font-semibold text-foreground">
                      Book Your Free Session
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Fill in your birth details so we can prepare before the call.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Labeled label="Full Name" required>
                        <input name="name" className={inputClass} placeholder="Your name" />
                      </Labeled>
                      <Labeled label="Phone / WhatsApp" required>
                        <input name="phone" className={inputClass} placeholder="+91 00000 00000" />
                      </Labeled>
                      <Labeled label="Email (optional)">
                        <input name="email" type="email" className={inputClass} placeholder="you@email.com" />
                      </Labeled>
                      <Labeled label="Date of Birth">
                        <input name="dob" type="date" className={inputClass} />
                      </Labeled>
                      <Labeled label="Time of Birth">
                        <input name="birthTime" type="time" className={inputClass} />
                      </Labeled>
                      <Labeled label="Place of Birth">
                        <input name="birthPlace" className={inputClass} placeholder="City, Country" />
                      </Labeled>
                    </div>

                    <Labeled label="Your Question / Concern">
                      <textarea
                        name="message"
                        rows={3}
                        className={cn(inputClass, "resize-none")}
                        placeholder="Tell us what you'd like guidance on…"
                      />
                    </Labeled>

                    {error && (
                      <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
                        {error}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <Button type="submit" variant="gold" size="lg" disabled={submitting}>
                        {submitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Sending…
                          </>
                        ) : (
                          <>
                            Get Free Consultation <ArrowRight size={16} />
                          </>
                        )}
                      </Button>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <ShieldCheck size={13} className="text-gold-500" /> No spam ·
                        100% free
                      </span>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
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
