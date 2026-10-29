"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/types";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Container } from "@/components/ui/container";

/**
 * Shop-by-category grid, hierarchy-aware (2 levels).
 *
 * Takes the flat category list and groups it into top-level parents, each with
 * their child categories shown as quick links on the card. Legacy flat
 * categories (no parentId) simply render as standalone top-level cards, so this
 * stays backward compatible with data created before the hierarchy existed.
 */
export function Categories({ categories = [] }: { categories?: Category[] }) {
  const byParent = new Map<string, Category[]>();
  const roots: Category[] = [];
  for (const c of categories) {
    if (c.parentId) {
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    } else {
      roots.push(c);
    }
  }
  const sortByOrder = (a: Category, b: Category) => (a.order ?? 999) - (b.order ?? 999);
  roots.sort(sortByOrder);

  return (
    <section className="py-20">
      <Container>
        <SectionHeader
          eyebrow="Curated Collections"
          title={<>Shop by <span className="text-gradient-royal">Category</span></>}
          description="From astrologically energised rings to sacred malas — find the piece that aligns with your path."
        />

        <StaggerContainer className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {roots.map((cat, i) => {
            const children = (byParent.get(cat.id) ?? []).sort(sortByOrder);
            return (
              <motion.div
                key={cat.slug}
                variants={staggerItem}
                className={i === 0 ? "lg:row-span-2" : ""}
              >
                <div
                  className={`group relative flex h-full min-h-[14rem] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 p-6 transition-all duration-500 hover:border-gold-400/40 ${
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
                  <div className="absolute inset-0" style={{ background: cat.tint }} />
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
                    {/* Parent title links to its own listing */}
                    <Link href={`/shop?category=${cat.slug}`} className="block">
                      <h3 className="text-xl font-semibold text-white">{cat.title}</h3>
                      <p className="mt-2 max-w-xs text-sm text-white/70">{cat.tagline}</p>
                    </Link>

                    {/* Child categories as quick links */}
                    {children.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {children.map((child) => (
                          <Link
                            key={child.slug}
                            href={`/shop?category=${child.slug}`}
                            className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:border-gold-300/60 hover:bg-white/20 hover:text-gold-100"
                          >
                            {child.title}
                          </Link>
                        ))}
                      </div>
                    )}

                    <Link
                      href={`/shop?category=${cat.slug}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-200"
                    >
                      Explore all
                      <ArrowUpRight
                        size={16}
                        className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                      />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </Container>
    </section>
  );
}
