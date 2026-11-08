"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ScrollText,
  HeartHandshake,
  Moon,
  Sparkles,
  Gem,
  ShieldAlert,
  CircleDot,
  CalendarDays,
  ArrowRight,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

/** Only tools that have a live page on the site. */
const tools = [
  { icon: ScrollText, label: "Free Kundli", desc: "Janam chart", href: "/free-kundli" },
  { icon: HeartHandshake, label: "Kundli Matching", desc: "Gun Milan", href: "/kundli-matching" },
  { icon: Moon, label: "Moon Sign", desc: "Find your Rashi", href: "/moon-sign-calculator" },
  { icon: Sparkles, label: "Nakshatra Finder", desc: "Your birth star", href: "/nakshatra-finder" },
  { icon: Gem, label: "Gemstone Suggestion", desc: "Stone for you", href: "/gemstone-recommendation" },
  { icon: ShieldAlert, label: "Dosha Checker", desc: "Manglik, Kaal Sarp", href: "/dosha-checker" },
  { icon: CircleDot, label: "Rudraksha", desc: "Your mukhi", href: "/rudraksha-recommendation" },
  { icon: CalendarDays, label: "Lucky Dates", desc: "Auspicious days", href: "/lucky-dates-calculator" },
];

/**
 * Compact quick-access strip of free tools, placed right under the hero so a
 * visitor can start a reading in one click. The detailed FreeTools band
 * further down still explains the main tools.
 */
export function PopularTools() {
  return (
    <section aria-labelledby="popular-tools-title" className="relative isolate overflow-hidden py-9 md:py-11">
      {/* soft celestial glow behind the strip */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 40%, rgba(230,180,58,0.10), transparent 70%), radial-gradient(ellipse 40% 60% at 85% 80%, rgba(122,69,245,0.07), transparent 70%)",
        }}
      />

      <Container>
        <SectionHeader
          eyebrow="Popular Tools"
          title={
            <span id="popular-tools-title">
              Free <span className="text-gradient-gold">Astrology Tools</span>
            </span>
          }
          description="Get instant insights with our easy-to-use Vedic tools. No sign-up needed."
          className="mb-8"
        />

        <StaggerContainer
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
          stagger={0.05}
        >
          {tools.map((t) => (
            <motion.div key={t.href} variants={staggerItem} whileHover={{ y: -5, transition: { type: "spring", stiffness: 320, damping: 22 } }}>
              <Link
                href={t.href}
                className="group relative flex h-full flex-col items-center overflow-hidden rounded-2xl border border-foreground/10 bg-white px-3 pb-4 pt-5 text-center shadow-[0_8px_24px_-18px_rgba(36,26,59,0.35)] transition-[border-color,box-shadow] duration-500 hover:border-gold-400/50 hover:shadow-[0_22px_50px_-26px_rgba(201,148,42,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60"
              >
                {/* hover glow */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-10 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-gold-400/0 blur-2xl transition-colors duration-500 group-hover:bg-gold-400/25"
                />

                {/* icon with a soft ring */}
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gold-200/70 to-royal-500/10 text-gold-600 ring-1 ring-gold-400/25 transition-all duration-500 group-hover:scale-110 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white group-hover:ring-gold-400/60">
                  <t.icon size={22} strokeWidth={1.6} />
                </span>

                <span className="relative mt-3 text-[13px] font-semibold leading-tight text-foreground transition-colors group-hover:text-gold-600">
                  {t.label}
                </span>
                <span className="relative mt-1 line-clamp-1 text-[11px] text-muted">{t.desc}</span>

                {/* "Try" hint slides in on hover */}
                <span className="relative mt-2 inline-flex h-4 items-center gap-1 text-[11px] font-semibold text-gold-600 opacity-0 transition-all duration-300 group-hover:opacity-100">
                  Try free <ArrowRight size={11} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>

                {/* gold underline */}
                <span
                  aria-hidden
                  className="absolute inset-x-6 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300 transition-transform duration-500 group-hover:scale-x-100"
                />
              </Link>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
