"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Phone,
  Video,
  Flame,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Star,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { useCurrency } from "@/lib/currency";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

/* ------------------------------------------------------------------ *
 *  Static content — swap for admin-managed data later if needed.
 * ------------------------------------------------------------------ */

const yagyaPills = [
  "Tara Devi Yagya",
  "Rahu Dosha Nivaran",
  "Das Mahavidya Puja",
  "Vedic Yagya for Wealth",
];

const yagyaStats = [
  { value: "5,000+", label: "Years of tradition" },
  { value: "2,100+", label: "Sacred mantras" },
  { value: "31,000", label: "Ahutis offered" },
];

type ConsultMode = "call" | "video";

interface ConsultPlan {
  title: string;
  priceInr: number;
  turnaround: string;
  mode: ConsultMode;
  popular?: boolean;
}

const plans: ConsultPlan[] = [
  { title: "Astrology Consultation", priceInr: 7800, turnaround: "in 80–90 days", mode: "call" },
  { title: "Medical Astrology Consultation", priceInr: 15000, turnaround: "in 25–30 days", mode: "call" },
  { title: "Premium Consultation", priceInr: 24000, turnaround: "in 22–25 days", mode: "call", popular: true },
  { title: "Premium Plus Consultation", priceInr: 51000, turnaround: "in 5 days", mode: "video" },
  { title: "Personal Meeting", priceInr: 240000, turnaround: "in 7 days", mode: "video" },
  { title: "Instant Consultation", priceInr: 96000, turnaround: "in 1 day", mode: "video" },
];

const featuredIn = ["Radio City", "Pinkvilla", "News18", "TOI", "Mid-Day"];

/* ------------------------------------------------------------------ */

export function ConsultationPricing() {
  const { format } = useCurrency();
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;
  const TEL = `tel:+${phoneDigits(store.supportPhone)}`;

  return (
    <section className="relative overflow-hidden py-20">
      {/* ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-royal-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl"
      />

      <div className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        <SectionHeader
          eyebrow="Rituals & Guidance"
          title={
            <>
              Sacred Yagyas &amp; Expert{" "}
              <span className="text-gradient-gold">Consultations</span>
            </>
          }
          description="Dissolve life's deepest blockages with ancient Vedic fire rituals, or book a personal call with our master astrologer — clarity for every path."
          className="mb-14"
        />

        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* ============================================================ *
           *  LEFT — Sacred Yagya promo card
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-foreground/10 bg-gradient-to-br from-[#1a1230] via-royal-700 to-[#2a1a4d] p-8 sm:p-10"
          >
            {/* decorative overlays + glows */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] [background-size:22px_22px]"
            />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/25 blur-3xl transition-transform duration-700 group-hover:scale-125" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-royal-500/30 blur-3xl" />

            <div className="relative flex flex-1 flex-col">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">
                <Flame size={14} className="text-gold-400" />
                Das Mahavidya · Sacred Yagya
              </div>

              <p className="max-w-sm text-sm italic leading-relaxed text-white/80">
                &ldquo;Still struggling with debt, blocked career, or Rahu Dosha?
                The answer may lie in a 5,000-year-old Vedic fire ritual.&rdquo;
              </p>

              <h3 className="mt-5 font-display text-4xl font-bold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.3)] sm:text-5xl">
                Tara Devi Yagya
              </h3>
              <p className="mt-2 text-lg font-semibold text-gold-300">
                Destroy Obstacles of Your Life
              </p>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
                Goddess Tara — the 2nd of the Das Mahavidyas — is invoked through
                sacred fire to dissolve Rahu Dosha, Pitra Dosha, debt and career
                blockages. Performed by Siddh priests, this Yagya opens the
                Manipura Chakra, igniting wealth, wisdom and protection.
              </p>

              {/* pills */}
              <div className="mt-6 flex flex-wrap gap-2.5">
                {yagyaPills.map((p) => (
                  <motion.span
                    key={p}
                    whileHover={{ y: -2 }}
                    className="cursor-default rounded-full border border-gold-400/30 bg-white/5 px-4 py-1.5 text-xs font-medium text-gold-200 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:bg-gold-400/10"
                  >
                    {p}
                  </motion.span>
                ))}
              </div>

              {/* benefit highlights — fills the card & adds value */}
              <div className="mt-7 grid grid-cols-3 gap-3">
                {yagyaStats.map((s) => (
                  <motion.div
                    key={s.label}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center backdrop-blur-sm transition-colors hover:border-gold-400/40"
                  >
                    <p className="font-display text-xl font-bold text-gold-300">
                      {s.value}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-white/65">
                      {s.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <div className="flex flex-wrap gap-3">
                  <a href={WA} target="_blank" rel="noreferrer">
                    <Button variant="gold" size="lg">
                      <Flame size={16} /> Book Tara Devi Yagya
                    </Button>
                  </a>
                  <Link href="/contact">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      Contact Us <ArrowRight size={15} />
                    </Button>
                  </Link>
                </div>

                <p className="mt-5 flex items-center gap-2 text-xs text-white/60">
                  <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  12 devotees booked this week · Next auspicious muhurat: Friday
                </p>
              </div>
            </div>
          </motion.div>

          {/* ============================================================ *
           *  RIGHT — Consultation Call pricing card
           * ============================================================ */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-nebula p-8 sm:p-10"
          >
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-royal-500/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-2xl italic text-muted">Get Your</p>
                <div className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-royal-500 to-royal-700 px-4 py-2 text-xl font-semibold text-white shadow-[0_12px_30px_-12px_rgba(122,69,245,0.6)]">
                  <Sparkles size={18} className="text-gold-300" />
                  Consultation Call
                </div>
              </div>

              {/* astrologer */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-gold-400/40">
                  <Image
                    src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=300&q=85"
                    alt="Senior Vedic astrologer"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="text-right sm:text-left">
                  <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    Pandit Astrounkle
                    <BadgeCheck size={14} className="text-royal-500" />
                  </p>
                  <p className="text-xs text-muted">Vedic Astrologer</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gold-600">
                    <Star size={11} className="fill-gold-500 text-gold-500" />
                    4.9 · 25K+ calls
                  </p>
                </div>
              </motion.div>
            </div>

            {/* plans list */}
            <ul className="relative mt-8 space-y-2.5">
              {plans.map((plan, i) => {
                const ModeIcon = plan.mode === "video" ? Video : Phone;
                return (
                  <motion.li
                    key={plan.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.05 * i }}
                  >
                    <a
                      href={WA}
                      target="_blank"
                      rel="noreferrer"
                      className="group/row relative flex items-center justify-between gap-4 rounded-2xl border border-foreground/8 bg-void/40 px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/40 hover:bg-void hover:shadow-[0_16px_40px_-24px_rgba(122,69,245,0.5)]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {plan.title}
                          </span>
                          {plan.popular && (
                            <span className="shrink-0 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold text-gold-600">
                              Popular
                            </span>
                          )}
                        </div>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <Clock size={11} />
                          {plan.turnaround}
                          <span className="mx-1 h-1 w-1 rounded-full bg-muted/50" />
                          <ModeIcon size={11} className="text-royal-500" />
                          {plan.mode === "video" ? "Audio / Video" : "Audio call"}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-base font-bold text-foreground">
                          {format(plan.priceInr)}
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/15 text-gold-600 transition-all duration-300 group-hover/row:bg-gold-400 group-hover/row:text-white">
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </a>
                  </motion.li>
                );
              })}
            </ul>

            {/* CTA + call line */}
            <div className="relative mt-7 flex flex-wrap items-center justify-between gap-3">
              <a href={WA} target="_blank" rel="noreferrer">
                <Button variant="gold" size="lg">
                  <Phone size={16} /> Book a Call Now
                </Button>
              </a>
              <a
                href={TEL}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                or call{" "}
                <span className="font-semibold text-foreground underline-offset-4 hover:underline">
                  {store.supportPhone}
                </span>
              </a>
            </div>

            {/* featured in */}
            <div className="relative mt-8 border-t border-foreground/8 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                As Featured In
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                {featuredIn.map((name) => (
                  <span
                    key={name}
                    className="text-sm font-semibold text-muted/70 transition-colors hover:text-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
