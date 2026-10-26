"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gem, ArrowRight } from "lucide-react";
import { RASHIS, RASHIS_SANSKRIT } from "@/lib/astrology/vedic";
import { gemForRashi } from "@/lib/astrology/gemstones";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

export function GemstoneZodiacView() {
  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Gemstone by Zodiac" }]} />
      </Container>

      <section className="relative overflow-hidden py-12 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(201,148,42,0.16), transparent 70%)" }}
        />
        <Container className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <Gem size={14} /> Lucky Stone by Rashi
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Gemstone for Your{" "}
              <span className="text-gradient-gold">Zodiac Sign</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Find the lucky gemstone for each Vedic Moon sign (Rashi). Every sign is ruled by a
              planet, and that planet&apos;s gemstone is the one traditionally recommended to wear.
            </p>
          </motion.div>
        </Container>
      </section>

      <Container className="py-6">
        <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.05}>
          {RASHIS.map((rashi, i) => {
            const gem = gemForRashi(i);
            return (
              <motion.div key={rashi} variants={staggerItem}>
                <div className="group flex h-full flex-col rounded-3xl border border-foreground/10 bg-nebula p-6 transition-all duration-500 hover:-translate-y-1 hover:border-gold-400/40 hover:shadow-[0_26px_60px_-30px_rgba(122,69,245,0.35)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-foreground">{rashi}</h3>
                      <p className="text-xs text-muted">{RASHIS_SANSKRIT[i]}</p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                      <Gem size={18} />
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-muted">Lucky gemstone</p>
                  <p className="text-lg font-bold text-foreground">
                    {gem.gem} <span className="text-sm font-normal text-gold-600">({gem.hindi})</span>
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{gem.benefits}</p>
                  <Link href={`/shop?search=${encodeURIComponent(gem.shopQuery)}`} className="mt-5">
                    <Button variant="outline" size="sm" className="w-full">
                      Shop {gem.gem} <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </Container>

      <section className="bg-void py-16">
        <Container>
          <SectionHeader
            eyebrow="Not sure of your sign?"
            title={<>Find Your <span className="text-gradient-gold">Moon Sign First</span></>}
            description="Your lucky stone depends on your Vedic Moon sign (Rashi), not your Western Sun sign. Calculate it free in seconds."
            className="mb-8"
          />
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/moon-sign-calculator"><Button variant="gold" size="lg">Find My Moon Sign</Button></Link>
            <Link href="/gemstone-recommendation"><Button variant="outline" size="lg">Full Gemstone Report</Button></Link>
          </div>
        </Container>
      </section>
    </div>
  );
}
