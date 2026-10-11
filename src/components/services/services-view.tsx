"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
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
  ArrowRight,
  Sparkles,
  CalendarCheck,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { AstroService } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

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

const steps = [
  { icon: CalendarCheck, title: "Book a Service", desc: "Pick a service and share your birth details." },
  { icon: MessageCircle, title: "Connect", desc: "Talk to a verified astrologer over call or chat." },
  { icon: ScrollText, title: "Get Your Report", desc: "Receive clear guidance and personalised remedies." },
  { icon: Sparkles, title: "Transform", desc: "Act on remedies and watch life align." },
];

export function ServicesView({ services }: { services: AstroService[] }) {
  const { format } = useCurrency();
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;

  return (
    <div className="pb-10">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Services" }]} />
      </Container>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden py-14 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(145,105,255,0.18), transparent 70%)",
          }}
        />
        <Container className="relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              Vedic Astrology
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400" />
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Astrology <span className="text-gradient-gold">Services</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Guidance from experienced Vedic astrologers — from your birth
              chart to the perfect gemstone, matchmaking to muhurat. Clarity for
              every turn of life.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href={WA} target="_blank" rel="noreferrer">
                <Button variant="gold" size="lg">
                  Book a Consultation <ArrowRight size={16} />
                </Button>
              </a>
              <Link href="/#zodiac">
                <Button variant="outline" size="lg">
                  Find My Stone
                </Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ---- Services grid ---- */}
      <Container className="py-6">
        <StaggerContainer
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {services.map((s) => {
            const Icon = iconMap[s.icon] ?? Sparkles;
            return (
              <motion.div key={s.slug} variants={staggerItem}>
                <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula p-6 transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-28px_rgba(122,69,245,0.4)]">
                  {s.popular && (
                    <span className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 text-[11px] font-semibold text-gold-600">
                      <Star size={11} className="fill-gold-500 text-gold-500" />
                      Popular
                    </span>
                  )}

                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600 transition-transform duration-500 group-hover:scale-110">
                    <Icon size={24} />
                  </span>

                  <Link
                    href={`/services/${s.slug}`}
                    className="mt-5 inline-block text-xl font-semibold text-foreground transition-colors hover:text-gold-600"
                  >
                    {s.title}
                  </Link>
                  <p className="mt-1 text-sm font-medium text-gold-600">
                    {s.tagline}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {s.description}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                        <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex items-end justify-between border-t border-foreground/8 pt-5">
                    <div>
                      <p className="text-xs text-muted">
                        {s.priceFrom === 0 ? "Price" : "Starting from"}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {s.priceFrom === 0 ? "Free" : format(s.priceFrom)}
                        <span className="ml-1 text-xs font-normal text-muted">
                          · {s.duration}
                        </span>
                      </p>
                    </div>
                    <Link href={`/services/${s.slug}`}>
                      <Button variant="gold" size="sm">
                        Book Now
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </Container>

      {/* ---- How it works ---- */}
      <section className="bg-void py-20">
        <Container>
          <SectionHeader
            eyebrow="Simple Process"
            title={<>How It <span className="text-gradient-gold">Works</span></>}
            description="From booking to breakthrough — a clear, guided journey."
          />
          <StaggerContainer
            className="relative mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
            stagger={0.1}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent lg:block"
            />
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                variants={staggerItem}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative">
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 text-white shadow-[0_12px_30px_-10px_rgba(122,69,245,0.5)]">
                    <s.icon size={22} />
                  </span>
                  <span className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-[11px] font-bold text-white shadow">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">
                  {s.desc}
                </p>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* ---- Astrologer profile ---- */}
      <Container className="py-20">
        <div className="grid items-center gap-10 rounded-[2rem] border border-foreground/10 bg-nebula p-6 sm:p-10 lg:grid-cols-[18rem_1fr]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-foreground/10"
          >
            <Image
              src="https://images.unsplash.com/photo-1600353068440-6361ef3a86e8?auto=format&fit=crop&w=800&q=85"
              alt="Senior Vedic astrologer"
              fill
              sizes="(max-width: 1024px) 100vw, 288px"
              className="object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              Meet Your Guide
            </div>
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
              Pandit Nakshatra Sharma
            </h2>
            <p className="mt-1 text-sm font-medium text-gold-600">
              Vedic Astrologer · 15+ years experience
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              A trusted name in Jyotish with over 25,000 consultations, Pandit
              ji blends classical Vedic wisdom with a warm, practical approach —
              giving you remedies you can actually follow.
            </p>

            <div className="mt-6 grid max-w-md grid-cols-3 gap-4">
              <Stat value="25K+" label="Consultations" />
              <Stat value="4.9★" label="Avg. Rating" />
              <Stat value="15+" label="Years" />
            </div>

            <a href={WA} target="_blank" rel="noreferrer" className="mt-8 inline-block">
              <Button variant="gold" size="lg">
                Talk to the Astrologer <ArrowRight size={16} />
              </Button>
            </a>
          </motion.div>
        </div>
      </Container>

      {/* ---- Final CTA ---- */}
      <Container className="pb-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-8 text-center text-white sm:p-14">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-gold-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Not Sure Where to Start?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/80">
              Book a free 10-minute discovery call and let us recommend the
              right service for you.
            </p>
            <a href={WA} target="_blank" rel="noreferrer" className="mt-7 inline-block">
              <Button variant="gold" size="lg">
                Book Free Discovery Call
              </Button>
            </a>
          </div>
        </div>
      </Container>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-void p-3 text-center">
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
