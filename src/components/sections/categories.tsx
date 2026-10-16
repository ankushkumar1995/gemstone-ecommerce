"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/types";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Container } from "@/components/ui/container";

export function Categories({ categories = [] }: { categories?: Category[] }) {
  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Curated Collections"
          title={<>Shop by <span className="text-gradient-royal">Category</span></>}
          description="From astrologically energised rings to sacred malas — find the piece that aligns with your path."
        />

        <StaggerContainer className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.slug}
              variants={staggerItem}
              className={i === 0 ? "lg:row-span-2" : ""}
            >
              <Link href={`/shop?category=${cat.slug}`} className="group block h-full">
                <div
                  className={`relative flex h-full min-h-[14rem] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 p-6 transition-all duration-500 group-hover:border-gold-400/40 ${
                    i === 0 ? "lg:min-h-[29.5rem]" : ""
                  }`}
                >
                  {/* real photo with zoom-on-hover */}
                  <Image
                    src={cat.image}
                    alt={cat.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* brand tint for mood */}
                  <div
                    className="absolute inset-0"
                    style={{ background: cat.tint }}
                  />
                  {/* readability scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                  {/* gold glow on hover */}
                  <motion.div
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 0%, rgba(242,202,86,0.25), transparent 60%)",
                    }}
                  />
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold text-white">
                      {cat.title}
                    </h3>
                    <p className="mt-2 max-w-xs text-sm text-white/70">
                      {cat.tagline}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-200">
                      Explore
                      <ArrowUpRight
                        size={16}
                        className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                      />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
