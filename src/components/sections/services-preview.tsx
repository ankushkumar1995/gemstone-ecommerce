"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
  Star,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { AstroService } from "@/types";
import { useCurrency } from "@/lib/currency";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, LucideIcon> = {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
};

/**
 * Homepage services preview — a compact grid of the top astrology services
 * that links through to the full /services page. Styled to match the
 * blog preview / featured sections.
 */
export function ServicesPreview({ services }: { services: AstroService[] }) {
  const { format } = useCurrency();
  if (services.length === 0) return null;

  // Show popular services first, then cap at six for a tidy preview grid.
  const preview = [...services]
    .sort((a, b) => Number(b.popular) - Number(a.popular))
    .slice(0, 6);

  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Astrology Services"
          title={
            <>
              Guidance for Every <span className="text-gradient-gold">Turn of Life</span>
            </>
          }
          description="From your birth chart to the perfect gemstone — book expert Vedic astrologers for clear, personalised guidance."
        />

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.06}
        >
          {preview.map((s) => {
            const Icon = iconMap[s.icon] ?? Sparkles;
            return (
              <motion.div key={s.slug} variants={staggerItem}>
                <Link
                  href={`/services/${s.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-28px_rgba(122,69,245,0.4)]"
                >
                  {s.image && (
                    <span className="relative block aspect-[16/9] w-full overflow-hidden">
                      <Image
                        src={s.image}
                        alt={s.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </span>
                  )}

                  <div className="flex h-full flex-col p-6">
                  {s.popular && (
                    <span className="absolute right-5 top-5 z-10 flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 text-[11px] font-semibold text-gold-600 backdrop-blur-sm">
                      <Star size={11} className="fill-gold-500 text-gold-500" />
                      Popular
                    </span>
                  )}

                  {!s.image && (
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600 transition-transform duration-500 group-hover:scale-110">
                      <Icon size={24} />
                    </span>
                  )}

                  <h3 className={`${s.image ? "" : "mt-5"} text-xl font-semibold text-foreground transition-colors group-hover:text-gold-600`}>
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-gold-600">
                    {s.tagline}
                  </p>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
                    {stripHtml(s.description)}
                  </p>

                  <div className="mt-auto flex items-end justify-between border-t border-foreground/8 pt-5">
                    <div>
                      <p className="text-xs text-muted">
                        {s.priceFrom === 0 ? "Price" : "Starting from"}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {s.priceFrom === 0 ? "Free" : format(s.priceFrom)}
                        <span className="ml-1 text-xs font-normal text-muted">
                          · {s.duration}
                        </span>
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600">
                      Book Now
                      <ArrowRight
                        size={15}
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </StaggerContainer>

        <div className="mt-12 flex justify-center">
          <Link href="/services">
            <Button variant="outline" size="lg">
              View All Services
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}

/** Rich-text descriptions are HTML; cards show a plain-text preview. */
function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
