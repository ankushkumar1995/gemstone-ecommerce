"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircleQuestion, ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/container";

/**
 * Compact "Ask the Astrologer" banner for the homepage — a gold gradient bar
 * that links through to the full /ask-astrologer page.
 */
export function AskAstrologerCta() {
  return (
    <section className="py-12">
      <Container>
        <Link href="/ask-astrologer" className="group block">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className="relative flex flex-col items-start gap-3.5 overflow-hidden rounded-3xl bg-gradient-to-r from-gold-400 to-gold-500 p-6 shadow-[0_20px_50px_-24px_rgba(201,148,42,0.6)] transition-shadow duration-500 hover:shadow-[0_28px_70px_-24px_rgba(201,148,42,0.75)] sm:p-9 md:flex-row md:items-center md:justify-between"
          >
            {/* decorative glows */}
            <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
            <div className="pointer-events-none absolute -bottom-16 left-20 h-48 w-48 rounded-full bg-royal-700/20 blur-3xl" />

            <div className="relative flex items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-[#3a2a08] backdrop-blur-sm transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                <MessageCircleQuestion size={24} />
              </span>
              <div>
                <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-[#2a1e05] sm:text-3xl">
                  Ask the Astrologer
                  <Sparkles size={18} className="text-[#3a2a08]/70" />
                </h2>
                <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed text-[#3a2a08]/85">
                  Ask any question you have and get a personalised, written
                  answer from an expert Vedic astrologer within 24 hours.
                </p>
              </div>
            </div>

            <span className="relative inline-flex shrink-0 items-center gap-2 rounded-full bg-royal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:gap-3 group-hover:bg-royal-600">
              Ask Your Question
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          </motion.div>
        </Link>
      </Container>
    </section>
  );
}
