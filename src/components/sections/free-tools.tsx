"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ScrollText, HeartHandshake, Moon, Gem, ShieldAlert, Star, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

const tools = [
  {
    icon: ScrollText,
    title: "Free Janam Kundli",
    desc: "Your Vedic birth chart — Lagna, Moon sign, Nakshatra & all 9 planets, instantly.",
    href: "/free-kundli",
    cta: "Get My Kundli",
    tag: "100% Free",
  },
  {
    icon: HeartHandshake,
    title: "Kundli Matching",
    desc: "Marriage compatibility with Ashtakoot Gun Milan — your score out of 36 gunas.",
    href: "/kundli-matching",
    cta: "Match Kundli",
    tag: "Gun Milan",
  },
  {
    icon: Gem,
    title: "Gemstone Recommendation",
    desc: "Discover which gemstone you should wear based on your birth chart.",
    href: "/gemstone-recommendation",
    cta: "Find My Stone",
    tag: "For You",
  },
  {
    icon: Moon,
    title: "Moon Sign Calculator",
    desc: "Find your true Vedic Moon sign (Rashi) and Nakshatra in seconds.",
    href: "/moon-sign-calculator",
    cta: "Find My Rashi",
    tag: "Instant",
  },
  {
    icon: ShieldAlert,
    title: "Dosha Checker",
    desc: "Check for Manglik, Kaal Sarp and Sade Sati in your kundli.",
    href: "/dosha-checker",
    cta: "Check Doshas",
    tag: "Free",
  },
  {
    icon: Star,
    title: "Gemstone by Zodiac",
    desc: "See the lucky gemstone for every zodiac sign (Rashi).",
    href: "/gemstone-by-zodiac",
    cta: "Explore Stones",
    tag: "By Sign",
  },
];

/**
 * Homepage "free tools" band — routes visitors to the free Kundli + Kundli
 * Matching SEO tool pages (big internal-linking + conversion driver).
 */
export function FreeTools() {
  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Free Astrology Tools"
          title={<>Start With a <span className="text-gradient-gold">Free Reading</span></>}
          description="No sign-up, instant results. Explore your chart, then talk to our astrologers for personalised guidance and the right gemstone."
          className="mb-14"
        />
        <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
          {tools.map((t) => (
            <motion.div key={t.title} variants={staggerItem}>
              <Link
                href={t.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-foreground/10 bg-nebula p-8 transition-all duration-500 hover:-translate-y-1.5 hover:border-gold-400/40 hover:shadow-[0_28px_70px_-30px_rgba(122,69,245,0.4)]"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-400/10 blur-3xl transition-transform duration-700 group-hover:scale-150" />

                <div className="relative flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600 transition-transform duration-500 group-hover:scale-110">
                    <t.icon size={26} />
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-gold-400/15 px-3 py-1 text-[11px] font-semibold text-gold-600">
                    <Sparkles size={11} /> {t.tag}
                  </span>
                </div>

                <h3 className="relative mt-6 font-display text-2xl font-semibold text-foreground transition-colors group-hover:text-gold-600">
                  {t.title}
                </h3>
                <p className="relative mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {t.desc}
                </p>

                <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-600">
                  {t.cta}
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
