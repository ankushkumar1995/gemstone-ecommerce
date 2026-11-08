"use client";

import { useMemo, useState } from "react";
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

export type ServiceCategoryChip = { id: string; name: string; slug: string };

export function ServicesView({
  services,
  categories = [],
  initialCategory = null,
}: {
  services: AstroService[];
  categories?: ServiceCategoryChip[];
  initialCategory?: string | null;
}) {
  const { format } = useCurrency();
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;

  const [active, setActive] = useState<string | null>(initialCategory);
  const activeCat = categories.find((c) => c.slug === active) ?? null;
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  // Uncategorised services always show under "All".
  const shown = activeCat ? services.filter((s) => s.categoryId === activeCat.id) : services;
  const countFor = (id: string) => services.filter((s) => s.categoryId === id).length;

  const pick = (slug: string | null) => {
    setActive(slug);
    // Shareable URL without a server round-trip.
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("category", slug);
    else url.searchParams.delete("category");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  return (
    <div className="pb-10">
      {/* ---- Hero (banner art on the right, clear space on the left for text) ---- */}
      <section className="relative isolate overflow-hidden border-b border-gold-400/20 bg-[#f4eefb] lg:min-h-[28rem]">
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10"
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            src="/images/Astrology-Services%20-Banner.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[80%_center] lg:object-right"
          />
        </motion.div>
        {/* readability: strong fade on small screens, left-side fade on desktop */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-white/65 lg:hidden" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-white/80 via-white/45 to-transparent lg:block" />

        <Container className="pt-6">
          <Breadcrumb items={[{ label: "Services" }]} />
        </Container>
        <Container className="relative pb-12 pt-8 text-center sm:pb-14 lg:pb-16 lg:pt-10 lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="lg:max-w-xl"
          >
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500 lg:justify-start">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              Vedic Astrology
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400" />
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Astrology <span className="text-gradient-gold">Services</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-foreground/75 lg:mx-0">
              Guidance from experienced Vedic astrologers, from your birth
              chart to the perfect gemstone, matchmaking to muhurat. Clarity for
              every turn of life.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link href="/consultation">
                <Button variant="gold" size="lg">
                  Book a Consultation <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/gemstone-by-zodiac">
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
        {categories.length > 0 && (
          <div
            role="toolbar"
            aria-label="Filter services by category"
            className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
          >
            <CategoryChip label="All" count={services.length} active={!activeCat} onClick={() => pick(null)} />
            {categories.map((c) => (
              <CategoryChip key={c.id} label={c.name} count={countFor(c.id)} active={activeCat?.id === c.id} onClick={() => pick(c.slug)} />
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No services in this category yet.</p>
        ) : (
        <StaggerContainer
          key={activeCat?.id ?? "all"}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {shown.map((s) => {
            const Icon = iconMap[s.icon] ?? Sparkles;
            return (
              <motion.div key={s.slug} variants={staggerItem} className="h-full">
                {/*
                  Fixed card anatomy so every card in a row lines up:
                  same-height media → category line → 2-line title → 1-line
                  tagline → 2-line description → max 3 features → footer
                  pinned to the bottom (mt-auto).
                */}
                <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-28px_rgba(122,69,245,0.4)]">
                  <Link
                    href={`/services/${s.slug}`}
                    aria-label={s.title}
                    className="relative block aspect-[16/9] w-full shrink-0 overflow-hidden"
                  >
                    {s.image ? (
                      <Image
                        src={s.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      // No banner: an icon panel of the same size keeps the grid even.
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-royal-500/10 via-gold-200/40 to-gold-400/15">
                        <span
                          aria-hidden
                          className="absolute inset-0"
                          style={{ background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.75), transparent 60%)" }}
                        />
                        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-gold-600 shadow-[0_12px_30px_-14px_rgba(201,148,42,0.7)] ring-1 ring-gold-400/30 transition-transform duration-500 group-hover:scale-110">
                          <Icon size={28} strokeWidth={1.6} />
                        </span>
                      </span>
                    )}
                    {s.popular && (
                      <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gold-600 shadow-sm backdrop-blur-sm">
                        <Star size={11} className="fill-gold-500 text-gold-500" />
                        Popular
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                  {!activeCat && (
                    <span className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wider text-royal-500">
                      {(s.categoryId && catName.get(s.categoryId)) || "Astrology Service"}
                    </span>
                  )}
                  <Link
                    href={`/services/${s.slug}`}
                    className={`${!activeCat ? "mt-1" : ""} line-clamp-2 min-h-[3.5rem] text-xl font-semibold leading-7 text-foreground transition-colors hover:text-gold-600`}
                  >
                    {s.title}
                  </Link>
                  <p className="mt-1 line-clamp-1 min-h-5 text-sm font-medium text-gold-600">
                    {s.tagline}
                  </p>
                  <p className="mt-2.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                    {stripHtml(s.description)}
                  </p>

                  {s.features.length > 0 && (
                    <ul className="mt-3.5 space-y-1.5">
                      {s.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                          <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                          <span className="line-clamp-1">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* flexible gap: pins the footer to the card bottom, never less than 1.25rem */}
                  <div aria-hidden className="min-h-5 flex-1" />

                  <div className="flex items-end justify-between border-t border-foreground/8 pt-4">
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
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>
        )}
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
              Pandit Astrounkle Sharma
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

function CategoryChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
        active
          ? "border-transparent bg-gradient-to-r from-royal-500 to-royal-700 text-white shadow-[0_8px_20px_-10px_rgba(122,69,245,0.6)]"
          : "border-foreground/10 bg-nebula text-foreground hover:border-gold-400/50"
      }`}
    >
      {label}
      <span className={`text-xs ${active ? "text-white/75" : "text-muted"}`}>{count}</span>
    </button>
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

/** Rich-text descriptions are HTML; cards show a plain-text preview. */
function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
