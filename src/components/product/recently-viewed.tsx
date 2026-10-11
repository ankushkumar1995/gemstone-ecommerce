"use client";

import { useEffect, useState } from "react";
import { useCommerce } from "@/lib/store";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer } from "@/components/ui/reveal";
import { Container } from "@/components/ui/container";

/**
 * Shows the shopper's recently viewed products. `excludeId` hides the product
 * currently being viewed (used on the product detail page).
 */
export function RecentlyViewed({
  excludeId,
  heading = "Recently Viewed",
  limit = 4,
}: {
  excludeId?: string;
  heading?: string;
  limit?: number;
}) {
  const { recentlyViewed } = useCommerce();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const list = recentlyViewed
    .filter((p) => p.id !== excludeId)
    .slice(0, limit);

  // avoid SSR/hydration mismatch (localStorage-backed), and hide if empty
  if (!mounted || list.length === 0) return null;

  return (
    <section className="py-16">
      <Container>
        <SectionHeader
          align="left"
          eyebrow="Pick Up Where You Left Off"
          title={<>{heading}</>}
        />
        <StaggerContainer className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}
