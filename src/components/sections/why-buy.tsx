"use client";

import { motion } from "framer-motion";
import {
  BadgeCheck,
  FlaskConical,
  Sparkles,
  RefreshCw,
  Truck,
  Headphones,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

const pillars = [
  {
    icon: BadgeCheck,
    title: "Govt-Certified",
    desc: "Every gemstone ships with an IGI / GIA / GII lab certificate you can verify online.",
  },
  {
    icon: FlaskConical,
    title: "100% Natural & Untreated",
    desc: "Ethically sourced natural stones — never glass-filled, dyed or synthetic.",
  },
  {
    icon: Sparkles,
    title: "Free Energisation",
    desc: "Complimentary prana-pratishtha (abhimantran) by Vedic pandits before dispatch.",
  },
  {
    icon: RefreshCw,
    title: "7-Day Return & Buyback",
    desc: "Not satisfied? Easy returns, plus lifetime buyback on certified stones.",
  },
  {
    icon: Truck,
    title: "Insured Free Shipping",
    desc: "Fully insured, discreet and tracked delivery across India — on us.",
  },
  {
    icon: Headphones,
    title: "Free Expert Consultation",
    desc: "Talk to our astrologers to find the stone that's genuinely right for you.",
  },
];

/**
 * The trust / USP wall — six reasons to buy, with icon tiles and a soft
 * royal-to-gold gradient accent on hover.
 */
export function WhyBuy() {
  return (
    <section className="relative py-20">
      <Container>
        <SectionHeader
          eyebrow="Why Nakshatra"
          title={
            <>
              Buy With <span className="text-gradient-royal">Confidence</span>
            </>
          }
          description="Authenticity, astrology and after-care — the reasons thousands trust us with their stones."
        />

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {pillars.map((p) => (
            <motion.div
              key={p.title}
              variants={staggerItem}
              whileHover={{ y: -6 }}
              className="group relative overflow-hidden rounded-3xl border border-foreground/10 bg-nebula p-7 transition-all duration-500 hover:border-transparent hover:shadow-[0_24px_60px_-26px_rgba(122,69,245,0.4)]"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-royal-400/15 to-gold-400/15 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-royal-600 transition-transform duration-500 group-hover:scale-110 group-hover:text-gold-600">
                <p.icon size={24} />
              </span>

              <h3 className="relative mt-5 text-lg font-semibold text-foreground">
                {p.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
