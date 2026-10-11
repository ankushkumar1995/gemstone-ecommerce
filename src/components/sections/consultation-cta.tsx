"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Phone, Check, Star } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

const perks = [
  "Personalised gemstone recommendation",
  "Based on your birth chart & planets",
  "100% free — no obligation to buy",
];

/**
 * Astrology consultation CTA — a two-column banner inviting shoppers to
 * book a free call with an in-house astrologer.
 */
export function ConsultationCta() {
  const store = useStoreSettings();
  return (
    <section className="py-16">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-gradient-to-br from-royal-500 to-royal-700 text-white">
          {/* decorative glows */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-gold-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2">
            {/* Copy */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-200 backdrop-blur-sm">
                <Star size={13} />
                Free Expert Guidance
              </span>

              <h2 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
                Confused Which Stone
                <span className="block text-gold-200">Is Right for You?</span>
              </h2>

              <p className="mt-4 max-w-md text-base leading-relaxed text-white/80">
                Talk to our Vedic astrologers for a free, personalised
                consultation and find the gemstone that truly aligns with your
                stars.
              </p>

              <ul className="mt-6 space-y-2.5">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-sm text-white/90">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400 text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/#zodiac">
                  <Button variant="gold" size="lg">
                    <Phone size={16} /> Book Free Consultation
                  </Button>
                </Link>
                <span className="text-sm text-white/70">
                  or call{" "}
                  <a
                    href={`tel:+${phoneDigits(store.supportPhone)}`}
                    className="font-semibold text-white underline-offset-4 hover:underline"
                  >
                    {store.supportPhone}
                  </a>
                </span>
              </div>
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden h-full min-h-[20rem] overflow-hidden rounded-3xl lg:block"
            >
              <Image
                src="https://images.unsplash.com/photo-1600353068440-6361ef3a86e8?auto=format&fit=crop&w=1200&q=85"
                alt="Astrology consultation"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-royal-700/60 to-transparent" />
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
