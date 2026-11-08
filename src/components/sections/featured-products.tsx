"use client";

import Link from "next/link";
import type { Product } from "@/types";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer } from "@/components/ui/reveal";
import { ProductCard } from "@/components/ui/product-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function FeaturedProducts({ products = [] }: { products?: Product[] }) {
  return (
    <section className="py-9 md:py-11">
      <Container>
        <SectionHeader
          eyebrow="Most Loved"
          title={<>Bestselling <span className="text-gradient-gold">Treasures</span></>}
          description="Hand-picked, certified and adored — the gemstones our community keeps coming back for."
        />

        <StaggerContainer className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </StaggerContainer>

        <div className="mt-6 flex justify-center">
          <Link href="/shop">
            <Button variant="primary" size="lg">
              View All Gemstones
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
