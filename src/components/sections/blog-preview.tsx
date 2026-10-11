"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, ArrowUpRight } from "lucide-react";
import type { Article } from "@/types";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";

/**
 * Blog / gemstone-guide preview — three editorial cards that build trust
 * and feed SEO. Links point to a future /blog route.
 */
export function BlogPreview({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;
  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Learn & Grow"
          title={
            <>
              The Gemstone <span className="text-gradient-royal">Journal</span>
            </>
          }
          description="Guides, astrology insights and buying tips — everything you need before you choose your stone."
        />

        <StaggerContainer
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3"
          stagger={0.08}
        >
          {articles.map((a) => (
            <motion.article key={a.slug} variants={staggerItem}>
              <Link
                href={`/blog/${a.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_26px_60px_-28px_rgba(36,26,59,0.45)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={a.image}
                    alt={a.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="absolute left-3 top-3 rounded-full bg-nebula/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-royal-600 backdrop-blur-sm">
                    {a.category}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Clock size={13} />
                    {a.readMins} min read
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-gold-600">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                    {a.excerpt}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-600">
                    Read article
                    <ArrowUpRight
                      size={15}
                      className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </StaggerContainer>

        <div className="mt-12 flex justify-center">
          <Link href="/blog">
            <Button variant="outline" size="lg">
              Read the Journal
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
