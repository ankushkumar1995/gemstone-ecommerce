"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getAllProducts } from "@/data/products";
import { SectionHeader } from "@/components/ui/section-header";
import { Container } from "@/components/ui/container";
import { ProductCard } from "@/components/ui/product-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabKey = "bestsellers" | "new" | "budget";

const tabs: { key: TabKey; label: string }[] = [
  { key: "bestsellers", label: "Bestsellers" },
  { key: "new", label: "New Arrivals" },
  { key: "budget", label: "Under ₹20,000" },
];

/**
 * Tabbed product showcase — lets shoppers quickly browse curated slices
 * of the catalogue without leaving the homepage.
 */
export function CollectionTabs() {
  const all = useMemo(() => getAllProducts(), []);
  const [tab, setTab] = useState<TabKey>("bestsellers");

  const list = useMemo(() => {
    switch (tab) {
      case "bestsellers":
        return all.filter((p) => p.badge === "Bestseller").slice(0, 8);
      case "new":
        return all.filter((p) => p.badge === "New" || p.badge === "Limited").slice(0, 8);
      case "budget":
        return all
          .filter((p) => p.price <= 20000)
          .sort((a, b) => a.price - b.price)
          .slice(0, 8);
    }
  }, [tab, all]);

  return (
    <section className="relative bg-void py-20">
      <Container>
        <SectionHeader
          eyebrow="Curated for You"
          title={
            <>
              Explore the <span className="text-gradient-gold">Collection</span>
            </>
          }
          description="Switch between our most-loved stones, fresh arrivals and budget-friendly picks."
        />

        {/* Tabs */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-nebula p-1.5 shadow-[0_10px_30px_-18px_rgba(36,26,59,0.5)]">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "relative isolate rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-300 sm:px-6",
                    active
                      ? "text-white"
                      : "text-muted hover:bg-foreground/[0.04] hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="collection-tab-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 shadow-[0_10px_28px_-8px_rgba(201,148,42,0.6)]"
                    >
                      {/* subtle inner sheen for a premium glassy top-light */}
                      <span className="absolute inset-x-2 top-0.5 h-1/2 rounded-full bg-white/20 blur-[2px]" />
                    </motion.span>
                  )}
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mt-12"
          >
            {list.length === 0 ? (
              <p className="py-16 text-center text-muted">
                Nothing here yet — check back soon.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex justify-center">
          <Link href="/shop">
            <Button variant="outline" size="lg">
              View All Gemstones
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
