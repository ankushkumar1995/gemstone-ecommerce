import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productService } from "@/modules/products";
import { ProductDetail } from "@/components/product/product-detail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer } from "@/components/ui/reveal";

// PDP pulls the live product (and related items) from the admin catalogue.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await productService.getActiveBySlug(slug);
  if (!res.ok) return { title: "Not Found — Astrounkle" };
  const product = res.value;
  return {
    title: product.seo?.metaTitle || `${product.name} — Astrounkle`,
    description: product.seo?.metaDescription || product.shortDescription,
    openGraph: product.seo?.ogImage
      ? { images: [{ url: product.seo.ogImage }] }
      : undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await productService.getActiveBySlug(slug);
  if (!res.ok) notFound();
  const product = res.value;

  const relatedRes = await productService.relatedActive(slug, 4);
  const related = relatedRes.ok ? relatedRes.value : [];

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
