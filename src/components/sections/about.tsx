"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Gem, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const stats = [
  { icon: Users, value: "25,000+", label: "Happy Customers" },
  { icon: Gem, value: "50,000+", label: "Stones Delivered" },
  { icon: ShieldCheck, value: "100%", label: "Certified Natural" },
  { icon: Sparkles, value: "15+", label: "Years of Trust" },
];

const highlights = [
  "Hand-picked, lab-certified natural gemstones",
  "Guided by experienced Vedic astrologers",
  "Energised (prana-pratishtha) before dispatch",
];

/**
 * Brand "About" section — a two-column story block with a layered image
 * collage on one side and brand narrative, highlights and stats on the other.
 */
export function About() {
  return (
    <section id="about" className="scroll-mt-24 py-20">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ---- Image collage ---- */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_30px_80px_-30px_rgba(36,26,59,0.45)]">
              <Image
                src="https://images.unsplash.com/photo-1611425143678-08fc480cafde?auto=format&fit=crop&w=1200&q=85"
                alt="Certified natural gemstones"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>

            {/* floating secondary image */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -bottom-8 -right-4 hidden h-44 w-40 overflow-hidden rounded-3xl border-4 border-nebula shadow-xl sm:block"
            >
              <Image
                src="https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=600&q=85"
                alt="Blue sapphire"
                fill
                sizes="160px"
                className="object-cover"
              />
            </motion.div>

            {/* floating trust badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="absolute -left-4 top-8 flex items-center gap-2.5 rounded-2xl border border-foreground/10 bg-nebula/95 px-4 py-3 shadow-lg backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white">
                <ShieldCheck size={18} />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">
                  IGI / GIA
                </p>
                <p className="text-xs text-muted">Lab Certified</p>
              </div>
            </motion.div>
          </motion.div>

          {/* ---- Story ---- */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              About Astrounkle
            </div>

            <h2 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
              Gemstones Chosen by the Stars,{" "}
              <span className="text-gradient-gold">Trusted by Thousands</span>
            </h2>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted">
              <p>
                At Astrounkle, we believe a gemstone is far more than an
                ornament — it is a bridge between you and the cosmos. For over a
                decade, we have brought together the ancient wisdom of Vedic
                astrology and the modern assurance of certified, lab-tested
                natural stones.
              </p>
              <p>
                Every gem in our collection is ethically sourced, personally
                hand-picked and verified by gemologists, then energised by
                learned pandits before it reaches you. No treatments, no
                synthetics — only authentic stones that carry genuine
                astrological power.
              </p>
            </div>

            <ul className="mt-7 space-y-3">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-3 text-sm text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
                    <Sparkles size={12} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>

            <div className="mt-9">
              <Link href="/shop">
                <Button variant="gold" size="lg">
                  Explore Our Collection
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ---- Stats strip ---- */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 grid grid-cols-2 gap-4 rounded-[2rem] border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)] sm:p-8 lg:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 px-2 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                <s.icon size={20} />
              </span>
              <span className="text-2xl font-bold text-foreground sm:text-3xl">
                {s.value}
              </span>
              <span className="text-xs text-muted sm:text-sm">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
