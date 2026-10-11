"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { SectionHeader } from "@/components/ui/section-header";
import { Rating } from "@/components/ui/rating";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Container } from "@/components/ui/container";

export function Testimonials() {
  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Loved by Thousands"
          title={<>What Our <span className="text-gradient-gold">Patrons</span> Say</>}
          description="Real stories from a community that trusts us with their most meaningful purchases."
        />

        <StaggerContainer className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t) => (
            <motion.figure
              key={t.id}
              variants={staggerItem}
              whileHover={{ y: -6 }}
              className="relative flex flex-col rounded-3xl glass border-gradient p-6"
            >
              <Quote className="text-gold-400/50" size={28} />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground/90">
                “{t.quote}”
              </blockquote>
              <Rating value={t.rating} size={13} className="mt-4" />
              <figcaption className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-sm font-semibold text-white">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted">{t.location}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
