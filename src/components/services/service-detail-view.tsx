"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
  Star,
  Check,
  Clock,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AstroService } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { useToast } from "@/lib/toast";
import { api } from "@/lib/api-client";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
};

export function ServiceDetailView({
  service,
  services,
}: {
  service: AstroService;
  services: AstroService[];
}) {
  const { format } = useCurrency();
  const store = useStoreSettings();
  const Icon = iconMap[service.icon] ?? Sparkles;

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Services", href: "/services" },
          { label: service.title },
        ]}
        className="mb-6"
      />

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* ---- Left: services list ---- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              All Services
            </p>
            <nav className="space-y-1">
              {services.map((s) => {
                const SIcon = iconMap[s.icon] ?? Sparkles;
                const active = s.slug === service.slug;
                return (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-gold-400/12 text-gold-600"
                        : "text-foreground hover:bg-foreground/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                        active
                          ? "bg-gradient-to-br from-gold-400 to-gold-500 text-white"
                          : "bg-foreground/5 text-gold-600"
                      )}
                    >
                      <SIcon size={16} />
                    </span>
                    <span className="flex-1 font-medium">{s.title}</span>
                    {active && <ChevronRight size={15} />}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 p-4 text-white">
              <p className="text-sm font-semibold">Need help choosing?</p>
              <p className="mt-1 text-xs text-white/75">
                Book a free discovery call.
              </p>
              <a
                href={`https://wa.me/${phoneDigits(store.whatsappNumber)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200 hover:text-white"
              >
                Chat now <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </aside>

        {/* ---- Right: detail + lead form ---- */}
        <div>
          {/* header card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-nebula p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-royal-400/15 to-gold-400/20 blur-2xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                  <Icon size={28} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
                      {service.title}
                    </h1>
                    {service.popular && (
                      <span className="flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 text-[11px] font-semibold text-gold-600">
                        <Star size={11} className="fill-gold-500 text-gold-500" />
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gold-600">
                    {service.tagline}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted">
                  {service.priceFrom === 0 ? "Price" : "Starting from"}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {service.priceFrom === 0 ? "Free" : format(service.priceFrom)}
                </p>
                <p className="flex items-center justify-end gap-1 text-xs text-muted">
                  <Clock size={12} /> {service.duration}
                </p>
              </div>
            </div>

            <p className="relative mt-5 text-base leading-relaxed text-muted">
              {service.description}
            </p>

            {/* trust row */}
            <div className="relative mt-5 flex flex-wrap gap-4 border-t border-foreground/8 pt-5 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <BadgeCheck size={16} className="text-gold-500" /> Verified astrologers
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-gold-500" /> 100% private
              </span>
              <span className="flex items-center gap-1.5">
                <Star size={16} className="text-gold-500" /> 4.9 rating
              </span>
            </div>
          </div>

          {/* what's included */}
          <div className="mt-6 rounded-[2rem] border border-foreground/10 bg-nebula p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">
              What&apos;s included
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {service.features.map((f) => (
                <div
                  key={f}
                  className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-void p-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400/20 to-royal-400/15 text-emerald-600">
                    <Check size={14} />
                  </span>
                  <p className="text-sm text-foreground">{f}</p>
                </div>
              ))}
            </div>
          </div>

          {/* lead form */}
          <LeadForm service={service} />
        </div>
      </div>
    </Container>
  );
}

/* ------------------------------------------------------------------ *
 * Lead-capture form
 * ------------------------------------------------------------------ */
function LeadForm({ service }: { service: AstroService }) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;

    setSubmitting(true);
    const res = await api.leads.create({
      source: "service",
      name: data.name,
      email: data.email,
      phone: data.phone,
      topic: service.slug,
      message: data.message,
      birth: { date: data.dob, time: data.tob, place: data.pob },
    });
    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      toast("Request received — we'll call you shortly!", "success");
      form.reset();
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <div
      id="book"
      className="mt-6 overflow-hidden rounded-[2rem] border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-6 sm:p-8"
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-6 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
              <CheckCircle2 size={30} />
            </span>
            <h3 className="mt-5 text-2xl font-semibold text-foreground">
              Request Received!
            </h3>
            <p className="mt-2 max-w-sm text-muted">
              Thank you. Our team will reach out within a few hours to schedule
              your <span className="font-medium text-foreground">{service.title}</span>.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-sm font-semibold text-gold-600 hover:text-gold-500"
            >
              Book another service
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gold-500" />
              <h2 className="text-xl font-semibold text-foreground">
                Book this Consultation
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Share your details and our astrologer will connect with you.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" name="name" required placeholder="Your name" />
                <Field
                  label="Phone / WhatsApp"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 00000 00000"
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                />
                <Field label="Date of Birth" name="dob" type="date" required />
                <Field label="Time of Birth" name="tob" type="time" />
                <Field
                  label="Place of Birth"
                  name="pob"
                  placeholder="City, Country"
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Your Question / Concern
                </span>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Tell us what you'd like guidance on…"
                  className={cn(inputClass, "resize-none")}
                />
              </label>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Request Callback"}
                </Button>
                <span className="text-xs text-muted">
                  🔒 Your details are private & never shared.
                </span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-mystic"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}
