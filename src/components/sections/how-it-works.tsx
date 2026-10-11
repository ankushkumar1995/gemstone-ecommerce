"use client";

import { motion } from "framer-motion";
import { Gem, BadgeCheck, Flame, PackageCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

const steps = [
  {
    icon: Gem,
    title: "Choose Your Stone",
    desc: "Pick by zodiac, planet or intention — or let our astrologers guide you.",
  },
  {
    icon: BadgeCheck,
    title: "Lab Certified",
    desc: "Your stone is tested and certified by IGI / GIA before it ever ships.",
  },
  {
    icon: Flame,
    title: "Energised (Prana Pratishtha)",
    desc: "Vedic pandits perform abhimantran to activate the gem's full energy.",
  },
  {
    icon: PackageCheck,
    title: "Delivered to You",
    desc: "Insured, discreet delivery to your door — ready to wear with ritual guidance.",
  },
];

/**
 * A four-step "how it works" rail with a connecting line on desktop and
 * numbered, animated step tiles.
 */
export function HowItWorks() {
  return (
    <section className="relative bg-void py-20">
      <Container>
        <SectionHeader
          eyebrow="Simple & Sacred"
          title={
            <>
              How It <span className="text-gradient-gold">Works</span>
            </>
          }
          description="From choosing your gem to wearing it — a seamless, trusted four-step journey."
        />

        <StaggerContainer
          className="relative mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.1}
        >
          {/* connecting line (desktop) */}
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
                <motion.span
                  whileHover={{ scale: 1.08, rotate: 6 }}
                  className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 text-white shadow-[0_12px_30px_-10px_rgba(122,69,245,0.5)]"
                >
                  <s.icon size={22} />
                </motion.span>
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
  );
}
