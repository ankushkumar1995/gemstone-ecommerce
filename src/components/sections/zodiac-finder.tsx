"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { zodiacSigns } from "@/data/zodiac";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function ZodiacFinder() {
  const [active, setActive] = useState(zodiacSigns[4]); // Leo default

  return (
    <section id="zodiac" className="scroll-mt-24 py-20">
      <Container>
        <SectionHeader
          eyebrow="Astrology Finder"
          title={<>Discover Your <span className="text-gradient-royal">Lucky Stone</span></>}
          description="Select your zodiac sign and reveal the gemstone the stars recommend for you."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          {/* zodiac grid */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {zodiacSigns.map((z) => {
              const isActive = z.sign === active.sign;
              return (
                <motion.button
                  key={z.sign}
                  onClick={() => setActive(z)}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  className={`group relative flex aspect-[4/5] flex-col items-center justify-end overflow-hidden rounded-2xl border p-3 text-center transition-all duration-300 ${
                    isActive
                      ? "border-gold-400/70 shadow-[0_14px_36px_-16px_rgba(201,148,42,0.6)]"
                      : "border-foreground/10 hover:border-foreground/25"
                  }`}
                >
                  {/* HD gemstone image */}
                  <Image
                    src={z.image}
                    alt={`${z.name} lucky stone`}
                    fill
                    sizes="(max-width: 640px) 33vw, 160px"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* readability + accent tint */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                  <div
                    className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: `linear-gradient(to top, ${z.accent}55, transparent)` }}
                  />
                  {isActive && (
                    <div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(to top, ${z.accent}66, transparent 70%)` }}
                    />
                  )}

                  {/* symbol chip (top) */}
                  <span
                    className="absolute left-1/2 top-3 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-lg backdrop-blur-sm"
                    style={{
                      background: "rgba(255,255,255,0.18)",
                      color: "#fff",
                      border: isActive ? `1.5px solid ${z.accent}` : "1.5px solid rgba(255,255,255,0.25)",
                    }}
                  >
                    {z.symbol}
                  </span>

                  {/* name + stone (bottom) */}
                  <span className="relative z-10">
                    <span className="block text-sm font-semibold text-white drop-shadow">
                      {z.name}
                    </span>
                    <span className="block text-[10px] font-medium text-white/70">
                      {z.luckyStone}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* detail panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.sign}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="relative overflow-hidden rounded-3xl glass-strong border-gradient"
            >
              {/* image hero band */}
              <div className="relative h-40 w-full overflow-hidden">
                <Image
                  src={active.image}
                  alt={`${active.name} — ${active.luckyStone}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-nebula via-nebula/40 to-transparent" />
                <div
                  className="absolute inset-0 opacity-50"
                  style={{ background: `linear-gradient(to top, transparent, ${active.accent}44)` }}
                />
                <div className="absolute bottom-3 left-5 flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl backdrop-blur-sm"
                    style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: `1.5px solid ${active.accent}` }}
                  >
                    {active.symbol}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-white drop-shadow">
                      {active.name}
                    </h3>
                    <p className="text-sm text-white/80">{active.dateRange}</p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 p-8 pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Detail label="Element" value={active.element} />
                  <Detail label="Ruling Planet" value={active.rulingPlanet} />
                </div>

                <div className="mt-6 rounded-2xl border border-gold-400/20 bg-gold-400/5 p-5">
                  <p className="text-xs uppercase tracking-wider text-gold-600">
                    Your Lucky Gemstone
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gradient-gold">
                    {active.luckyStone}
                  </p>
                </div>

                <Link
                  href={`/shop?zodiac=${active.sign}`}
                  className="mt-6 inline-block"
                >
                  <Button variant="gold">
                    Shop {active.name} Stones <ArrowRight size={16} />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-nebula p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
