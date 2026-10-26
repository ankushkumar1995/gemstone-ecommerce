"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, type LucideIcon } from "lucide-react";
import type { ReportResponse } from "@/types/astrology";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { BirthForm } from "./birth-form";

/**
 * Shared shell for the single-input astrology tools (Moon Sign, Nakshatra,
 * Gemstone, Dosha checkers…). Renders a consistent hero + birth form, then
 * delegates the result display to each tool via `renderResult`.
 */
export function AstroToolView({
  breadcrumb,
  badge,
  badgeIcon: BadgeIcon,
  titleTop,
  titleAccent,
  intro,
  cta,
  requireTime = false,
  heroImage,
  heroStats,
  renderResult,
  children,
}: {
  breadcrumb: string;
  badge: string;
  badgeIcon: LucideIcon;
  titleTop: string;
  titleAccent: string;
  intro: string;
  cta: string;
  requireTime?: boolean;
  /** Optional full-width hero background image for a richer landing page. */
  heroImage?: string;
  /** Optional trust stats shown in the image hero. */
  heroStats?: { value: string; label: string }[];
  renderResult: (data: ReportResponse) => ReactNode;
  /** SEO prose / extra sections rendered below the form. */
  children?: ReactNode;
}) {
  const [data, setData] = useState<ReportResponse | null>(null);

  const handleResult = (d: ReportResponse) => {
    setData(d);
    setTimeout(() => document.getElementById("tool-result")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: breadcrumb }]} />
      </Container>

      {heroImage ? (
        /* ---- Rich image hero ---- */
        <section className="relative overflow-hidden">
          <div className="relative flex min-h-[26rem] items-center justify-center py-16 sm:min-h-[30rem]">
            <Image
              src={heroImage}
              alt={`${titleTop} ${titleAccent}`}
              fill
              priority
              sizes="100vw"
              className="scale-105 object-cover"
            />
            {/* layered gradients for depth + readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-void/80 via-royal-900/75 to-void/95" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,transparent,rgba(26,18,48,0.55))]" />
            {/* floating gold glow */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-gold-400/15 blur-[90px]"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
              transition={{ duration: 7, repeat: Infinity }}
            />

            <Container className="relative text-center">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-200 backdrop-blur-sm">
                  <BadgeIcon size={14} /> {badge}
                </span>
                <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.5)] sm:text-5xl md:text-6xl">
                  {titleTop} <span className="text-gold-300">{titleAccent}</span>
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/85">{intro}</p>

                {/* scroll-to-form CTA */}
                <div className="mt-7">
                  <a href="#tool-form">
                    <Button variant="gold" size="lg">
                      {cta} <ChevronDown size={16} />
                    </Button>
                  </a>
                </div>

                {/* trust stats */}
                {heroStats && heroStats.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                    className="mx-auto mt-9 flex max-w-xl flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 backdrop-blur-sm"
                  >
                    {heroStats.map((s) => (
                      <div key={s.label} className="text-center">
                        <p className="font-display text-2xl font-bold text-gold-300">{s.value}</p>
                        <p className="text-xs text-white/70">{s.label}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </Container>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden py-12 sm:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(145,105,255,0.18), transparent 70%)" }}
          />
          <Container className="relative text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
                <BadgeIcon size={14} /> {badge}
              </span>
              <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
                {titleTop} <span className="text-gradient-gold">{titleAccent}</span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">{intro}</p>
            </motion.div>
          </Container>
        </section>
      )}

      <div id="tool-form" className="scroll-mt-24">
        <Container className={heroImage ? "relative z-10 -mt-10 sm:-mt-14" : undefined}>
          <BirthForm cta={cta} requireTime={requireTime} onResult={handleResult} />
        </Container>
      </div>

      <AnimatePresence>
        {data && (
          <motion.section
            id="tool-result"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="scroll-mt-24 py-14"
          >
            <Container>{renderResult(data)}</Container>
          </motion.section>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}

/** Small helper for consistent SEO prose blocks below the tool. */
export function ToolProse({ children }: { children: ReactNode }) {
  return (
    <section className="py-16">
      <Container>
        <div className="mx-auto max-w-3xl space-y-5 text-sm leading-relaxed text-muted">{children}</div>
      </Container>
    </section>
  );
}

export function ResultHeading({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-white">
        {Icon ? <Icon size={26} /> : <Sparkles size={26} />}
      </span>
      <h2 className="font-display text-3xl font-bold text-foreground">{children}</h2>
    </div>
  );
}
