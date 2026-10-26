"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, ArrowRight, BadgeCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

interface Astrologer {
  name: string;
  role: string;
  meta: string;
  image: string;
  cta: string;
  featured?: boolean;
}

const astrologers: Astrologer[] = [
  {
    name: "Acharya Vihaan Ji",
    role: "Chief Vedic Astrologer",
    meta: "25,000+ consultations · 20+ years of Jyotish mastery",
    image:
      "https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=1000&q=85",
    cta: "Book Consultation",
    featured: true,
  },
  {
    name: "Astrologer Meera Ji",
    role: "Palmistry & Kundli Expert",
    meta: "15+ years of experience · 5,000+ clients consulted",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1000&q=85",
    cta: "Take Consultation",
  },
  {
    name: "Guru Aditi Ji",
    role: "Top 5% for Accuracy",
    meta: "Selected for accuracy, expertise & trust.",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=85",
    cta: "Take Consultation",
  },
  {
    name: "Pandit Rishabh Ji",
    role: "Top 1% of the Team",
    meta: "Hand-picked premium astrologers from our senior team.",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=85",
    cta: "Take Consultation",
  },
];

export function Astrologers() {
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;

  const [featured, wide, ...small] = astrologers;

  return (
    <section className="relative overflow-hidden py-20">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-royal-500/10 blur-3xl"
      />

      <div className="relative w-full px-4 sm:px-6 lg:px-10 xl:px-16">
        <SectionHeader
          eyebrow="Meet Our Experts"
          title={
            <>
              Real Astrologers. Real Conversations.{" "}
              <span className="text-gradient-gold">Expert Guidance.</span>
            </>
          }
          description="One-on-one consultations with our certified team of Vedic astrologers — for career, marriage, health, and the decisions that can't wait."
          className="mb-14 max-w-3xl"
        />

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---- Featured (tall) card ---- */}
          <AstrologerCard
            astro={featured}
            href={WA}
            className="lg:row-span-2 lg:min-h-[32rem]"
            index={0}
          />

          {/* ---- right column ---- */}
          <div className="grid gap-5">
            <AstrologerCard
              astro={wide}
              href={WA}
              className="min-h-[15rem]"
              index={1}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {small.map((astro, i) => (
                <AstrologerCard
                  key={astro.name}
                  astro={astro}
                  href={WA}
                  className="min-h-[15rem]"
                  index={2 + i}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AstrologerCard({
  astro,
  href,
  className,
  index,
}: {
  astro: Astrologer;
  href: string;
  className?: string;
  index: number;
}) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className={`group relative flex items-end overflow-hidden rounded-[1.75rem] border border-foreground/10 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.5)] ${className ?? ""}`}
    >
      {/* image */}
      <Image
        src={astro.image}
        alt={astro.name}
        fill
        sizes="(max-width: 1024px) 100vw, 40vw"
        className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
      />

      {/* gradient scrim for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-opacity duration-500 group-hover:from-black/90" />

      {/* gold ring on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-transparent transition-all duration-500 group-hover:ring-gold-400/50" />

      {astro.featured && (
        <span className="absolute left-5 top-5 flex items-center gap-1.5 rounded-full bg-gold-400/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          <Star size={11} className="fill-white" />
          Featured
        </span>
      )}

      {/* content */}
      <div className="relative w-full p-6">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gold-300">
          <BadgeCheck size={13} />
          {astro.role}
        </div>
        <h3 className="font-display text-2xl font-semibold text-white drop-shadow sm:text-[1.6rem]">
          {astro.name}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-white/75">
          {astro.meta}
        </p>

        <span className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-royal-700 transition-all duration-300 group-hover:bg-gold-400 group-hover:text-white">
          {astro.cta}
          <ArrowRight
            size={15}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </motion.a>
  );
}
