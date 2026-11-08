"use client";

import { useMemo, useState } from "react";
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
  Moon,
  Sun,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import type { AstroService } from "@/types";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";

const iconMap: Record<string, LucideIcon> = {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
  Star,
  Moon,
  Sun,
  Sparkles,
};

export type PreviewCategory = { id: string; name: string; slug: string; icon: string };

/** Cards shown first, and added by each "Load more" (a multiple of 3 = full rows). */
const PAGE_SIZE = 6;

/**
 * Homepage services preview. Categories sit on the left (a chip row on
 * mobile) and the matching service cards on the right. Whole card opens the
 * service page; "Book Now" jumps straight to the booking form on that page.
 */
export function ServicesPreview({
  services,
  categories = [],
}: {
  services: AstroService[];
  categories?: PreviewCategory[];
}) {
  const { format } = useCurrency();
  const [active, setActive] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Switching category starts again from the first page.
  const pick = (slug: string | null) => { setActive(slug); setVisible(PAGE_SIZE); };

  const activeCat = categories.find((c) => c.slug === active) ?? null;
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const countFor = (id: string) => services.filter((s) => s.categoryId === id).length;

  // Popular first; uncategorised services show under "All".
  const list = useMemo(() => {
    const pool = activeCat ? services.filter((s) => s.categoryId === activeCat.id) : services;
    return [...pool].sort((a, b) => Number(b.popular) - Number(a.popular));
  }, [services, activeCat]);
  const shown = list.slice(0, visible);
  const remaining = list.length - shown.length;

  if (services.length === 0) return null;
  const hasCats = categories.length > 0;

  return (
    <section className="py-9 md:py-11">
      <Container>
        <SectionHeader
          eyebrow="Astrology Services"
          title={
            <>
              Guidance for Every <span className="text-gradient-gold">Turn of Life</span>
            </>
          }
          description="Kundli, marriage, career and more. Book expert Vedic astrologers for clear, personalised guidance."
        />

        <div className={cn("mt-6", hasCats && "lg:grid lg:grid-cols-[16.5rem_1fr] lg:items-start lg:gap-5")}>
          {hasCats && (
            <>
              {/* Mobile: scrollable chips */}
              <div
                role="toolbar"
                aria-label="Filter services by category"
                className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden"
              >
                <Chip label="All" active={!activeCat} onClick={() => pick(null)} />
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} active={activeCat?.id === c.id} onClick={() => pick(c.slug)} />
                ))}
              </div>

              {/* Desktop: category rail */}
              <aside className="hidden lg:sticky lg:top-24 lg:block">
                <div className="rounded-2xl border border-foreground/10 bg-nebula p-2 shadow-[0_18px_40px_-30px_rgba(122,69,245,0.35)]">
                  <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                    Categories
                  </p>
                  <nav aria-label="Service categories" className="space-y-0.5">
                    <RailItem icon={LayoutGrid} label="All Services" count={services.length} active={!activeCat} onClick={() => pick(null)} />
                    {categories.map((c) => (
                      <RailItem
                        key={c.id}
                        icon={iconMap[c.icon] ?? Sparkles}
                        label={c.name}
                        count={countFor(c.id)}
                        active={activeCat?.id === c.id}
                        onClick={() => pick(c.slug)}
                      />
                    ))}
                  </nav>
                  <Link
                    href="/services"
                    className="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-br from-royal-500 to-royal-700 px-3.5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Browse all services
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </aside>
            </>
          )}

          <div className="min-w-0">
            <motion.div
              key={activeCat?.id ?? "all"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              // With the category rail: 2 columns until there is room for 3.
              className={cn("grid grid-cols-1 gap-3.5 sm:grid-cols-2", hasCats ? "xl:grid-cols-3" : "lg:grid-cols-3")}
            >
              {shown.map((s) => {
                const Icon = iconMap[s.icon] ?? Sparkles;
                const cat = s.categoryId ? catById.get(s.categoryId) : undefined;
                return (
                  <article
                    key={s.slug}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-nebula transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-[0_22px_48px_-28px_rgba(122,69,245,0.45)]"
                  >
                    {s.image && (
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        <Image
                          src={s.image}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {s.popular && <PopularBadge className="absolute right-2.5 top-2.5 bg-white/90 shadow-sm backdrop-blur" />}
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-4">
                      {!s.image && (
                        <div className="mb-3 flex items-start justify-between">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                            <Icon size={20} />
                          </span>
                          {s.popular && <PopularBadge className="bg-gold-400/15" />}
                        </div>
                      )}

                      {!activeCat && cat && (
                        <span className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-royal-500">{cat.name}</span>
                      )}

                      <h3 className="text-base font-semibold leading-snug text-foreground">
                        {/* Stretched link: the whole card opens the service page */}
                        <Link
                          href={`/services/${s.slug}`}
                          className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-gold-600 focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-gold-400/60"
                        >
                          {s.title}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-[13px] font-medium text-gold-600">{s.tagline}</p>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{stripHtml(s.description)}</p>

                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-foreground/8 pt-3.5">
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted">{s.priceFrom === 0 ? "Price" : "Starting from"}</p>
                          <p className="truncate text-base font-bold leading-tight text-foreground">
                            {s.priceFrom === 0 ? "Free" : format(s.priceFrom)}
                            <span className="ml-1 text-[11px] font-normal text-muted">· {s.duration}</span>
                          </p>
                        </div>
                        {/* CTA: straight to the booking form on the detail page */}
                        <ButtonLink
                          href={`/services/${s.slug}#book`}
                          aria-label={`Book ${s.title}`}
                          variant="gold"
                          size="sm"
                          className="relative z-10 shrink-0 gap-1.5"
                        >
                          Book Now
                          <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                        </ButtonLink>
                      </div>
                    </div>
                  </article>
                );
              })}
            </motion.div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {remaining > 0 && (
                <Button variant="gold" size="md" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Load more
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] tabular-nums">{remaining}</span>
                </Button>
              )}
              <Link href={activeCat ? `/services?category=${activeCat.slug}` : "/services"}>
                <Button variant="outline" size="md">
                  View All Services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function PopularBadge({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-gold-600", className)}>
      <Star size={11} className="fill-gold-500 text-gold-500" />
      Popular
    </span>
  );
}

function RailItem({ icon: I, label, count, active, onClick }: { icon: LucideIcon; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
        active ? "bg-gold-400/12 font-semibold text-gold-600" : "font-medium text-foreground hover:bg-foreground/[0.04]"
      )}
    >
      {active && <span aria-hidden className="absolute -left-0.5 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-gold-400 to-gold-500" />}
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-sm" : "bg-foreground/5 text-gold-600 group-hover/item:bg-gold-400/15"
        )}
      >
        <I size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", active ? "bg-white/70 text-gold-600" : "bg-foreground/5 text-muted")}>{count}</span>
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
        active
          ? "border-transparent bg-gradient-to-r from-royal-500 to-royal-700 text-white shadow-[0_8px_20px_-10px_rgba(122,69,245,0.6)]"
          : "border-foreground/10 bg-nebula text-foreground hover:border-gold-400/50"
      )}
    >
      {label}
    </button>
  );
}

/** Rich-text descriptions are HTML; cards show a plain-text preview. */
function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
