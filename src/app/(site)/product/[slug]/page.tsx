import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getRelatedProducts,
  products,
} from "@/data/products";
import { ProductDetail } from "@/components/product/product-detail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer } from "@/components/ui/reveal";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Not Found — Nakshatra" };
  return {
    title: `${product.name} — Nakshatra`,
    description: product.shortDescription,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(slug, 4);

  return (
    <>
      <ProductDetail product={product} />

      <RecentlyViewed excludeId={product.slug === slug ? product.id : undefined} />

      {related.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <SectionHeader
              align="left"
              eyebrow="You May Also Like"
              title={<>Related <span className="text-gradient-gold">Treasures</span></>}
            />
            <StaggerContainer className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </StaggerContainer>
          </div>
        </section>
      )}
    </>
  );
}
