"use client";

/**
 * Homepage "Benefits of Online Astrology Consultation" section (above Blog).
 * Six benefit cards with a numbered icon; hover lifts the card, turns the icon
 * gold and draws a gold line along the bottom. A CTA strip closes the section.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeCheck, Clock3, Globe2, HandHeart, IndianRupee, Lock, MessageCircle, ScrollText, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Globe2, title: "Consult from anywhere", text: "Talk to an astrologer from home over call, chat or video. No travel and no waiting in queues." },
  { icon: BadgeCheck, title: "Verified expert astrologers", text: "Every astrologer is screened for Vedic knowledge and real consultation experience." },
  { icon: ScrollText, title: "Accurate birth chart reading", text: "Guidance from your exact kundli: planets, houses, dashas and current transits." },
  { icon: HandHeart, title: "Practical remedies", text: "Simple mantras, daan and lifestyle steps you can actually follow. No fear, no pressure." },
  { icon: Lock, title: "100% private and confidential", text: "Your birth details and conversations are never shared with anyone." },
  { icon: Clock3, title: "Quick answers when it matters", text: "Get clarity on career, marriage, health or money decisions at the time you need it." },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function ConsultationBenefits() {
  const reduce = useReducedMotion();
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;

  return (
    <section aria-labelledby="benefits-title" className="relative overflow-hidden py-9 md:py-11">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl" />

      <Container className="relative">
        <SectionHeader
          eyebrow="Why Consult Online"
          title={
            <span id="benefits-title">
              Benefits of Online Astrology Consultation <span className="text-gradient-gold">with Astrounkle</span>
            </span>
          }
          description="Expert Vedic guidance for every turn of life, from the comfort of your home."
        />

        <motion.ul
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {BENEFITS.map((b, i) => (
            <motion.li
              key={b.title}
              variants={{ hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}
              whileHover={reduce ? undefined : { y: -5 }}
              className="group relative overflow-hidden rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(36,26,59,0.5)] transition-[border-color,box-shadow] duration-300 hover:border-gold-400/50 hover:shadow-[0_26px_56px_-30px_rgba(201,148,42,0.55)]"
            >
              {/* big faint number */}
              <span aria-hidden className="pointer-events-none absolute -right-1 -top-3 font-display text-[4.5rem] font-bold leading-none text-foreground/[0.04] transition-colors duration-300 group-hover:text-gold-400/15">
                {String(i + 1).padStart(2, "0")}
              </span>

              <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/12 to-gold-400/20 text-gold-600 transition-all duration-300 group-hover:scale-105 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white group-hover:shadow-[0_10px_22px_-10px_rgba(201,148,42,0.9)]">
                <b.icon size={20} />
              </span>
              <h3 className="relative mt-3.5 text-[15.5px] font-semibold text-foreground">{b.title}</h3>
              <p className="relative mt-1 text-[13.5px] leading-relaxed text-muted">{b.text}</p>

              {/* gold line grows on hover */}
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-500 transition-transform duration-500 group-hover:scale-x-100 motion-reduce:transition-none" />
            </motion.li>
          ))}
        </motion.ul>

        {/* CTA strip */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease }}
          className="relative mt-5 flex flex-col items-start gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-royal-600 to-royal-800 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6"
        >
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-gold-400/25 blur-3xl" />
          <div className="relative">
            <p className="text-lg font-semibold">Have a question about your future?</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/75">
              <IndianRupee size={14} /> Your first consultation is free. Talk to a verified astrologer today.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-2.5">
            <ButtonLink href="/#free-consultation" variant="gold" size="md" className="gap-1.5">
              Talk to an Astrologer <ArrowRight size={15} />
            </ButtonLink>
            <a
              href={WA}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/30 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <MessageCircle size={15} /> WhatsApp us
            </a>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
