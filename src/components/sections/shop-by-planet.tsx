"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { planets } from "@/data/planets";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";

/**
 * Navagraha — nine-planet gemstone grid. Each card shows the planet, its
 * ruling gemstone (with HD image on hover) and links to that stone's product.
 */
export function ShopByPlanet() {
  return (
    <section className="relative py-20">
      <Container>
        <SectionHeader
          eyebrow="Navagraha · नवग्रह"
          title={
            <>
              Shop by <span className="text-gradient-gold">Planet</span>
            </>
          }
          description="In Vedic astrology each of the nine planets rules a gemstone. Find yours and balance its energy."
        />

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {planets.map((p) => (
            <motion.div key={p.key} variants={staggerItem}>
              <Link
                href={`/product/${p.productSlug}`}
                className="group relative flex items-center gap-5 overflow-hidden rounded-3xl border border-foreground/10 bg-nebula p-5 transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-26px_rgba(36,26,59,0.45)]"
              >
                {/* accent glow */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle at 85% 50%, ${p.accent}22, transparent 60%)`,
                  }}
                />

                {/* stone image */}
                <div
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-nebula transition-all duration-500"
                  style={{ ["--tw-ring-color" as string]: `${p.accent}66` }}
                >
                  <Image
                    src={p.image}
                    alt={p.stone}
                    fill
                    sizes="80px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                </div>

                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {p.name}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {p.sanskrit}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-base font-semibold"
                    style={{ color: p.accent }}
                  >
                    {p.stone}
                    <span className="ml-1 text-sm font-normal text-muted">
                      ({p.stoneHindi})
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">
                    {p.benefit}
                  </p>
                </div>

                <ArrowUpRight
                  size={18}
                  className="relative shrink-0 translate-y-1 text-foreground/25 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:text-gold-500 group-hover:opacity-100"
                />
              </Link>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
