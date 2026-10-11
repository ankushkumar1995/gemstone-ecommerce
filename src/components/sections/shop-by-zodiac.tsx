"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { zodiacSigns } from "@/data/zodiac";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

/**
 * A cinematic 12-sign grid. Each card deep-links into the shop filtered
 * by that zodiac sign and is themed with the sign's accent colour.
 */
export function ShopByZodiac() {
  return (
    <section className="relative overflow-hidden py-20">
      {/* soft radial glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(145,105,255,0.18), transparent 70%)",
        }}
      />

      <Container className="relative">
        <SectionHeader
          eyebrow="Guided by the Stars"
          title={
            <>
              Shop by Your <span className="text-gradient-royal">Zodiac</span>
            </>
          }
          description="Pick your sign and discover the gemstone the cosmos recommends for you."
        />

        <StaggerContainer
          className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          stagger={0.05}
        >
          {zodiacSigns.map((z) => (
            <motion.div key={z.sign} variants={staggerItem}>
              <Link
                href={`/shop?zodiac=${z.sign}`}
                className="group relative block overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_60px_-24px_rgba(36,26,59,0.4)]"
              >
                {/* ---- Image backdrop ---- */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={z.image}
                    alt={`${z.name} lucky stone — ${z.luckyStone}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* accent tint for mood */}
                  <div
                    className="absolute inset-0 mix-blend-multiply opacity-60 transition-opacity duration-500 group-hover:opacity-40"
                    style={{
                      background: `linear-gradient(150deg, ${z.accent}cc, ${z.accent}33 70%)`,
                    }}
                  />
                  {/* bottom scrim so the symbol + name stay crisp */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                  {/* symbol pill — golden */}
                  <span className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-2xl text-white shadow-md transition-transform duration-500 group-hover:scale-110">
                    {z.symbol}
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="absolute right-3 top-3 text-white/70 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />

                  {/* name over the image */}
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="text-lg font-semibold text-white drop-shadow-sm">
                      {z.name}
                    </h3>
                    <p className="text-xs font-medium text-white/80">
                      {z.dateRange}
                    </p>
                  </div>
                </div>

                {/* ---- Info strip ---- */}
                <div className="flex items-center gap-2 px-4 py-3.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-gold-400 to-gold-500" />
                  <span className="text-xs text-muted">Lucky stone</span>
                  <span className="ml-auto text-sm font-semibold text-gold-600">
                    {z.luckyStone}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
