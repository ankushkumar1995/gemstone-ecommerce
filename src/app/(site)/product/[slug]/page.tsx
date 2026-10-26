import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productService } from "@/modules/products";
import { ProductDetail } from "@/components/product/product-detail";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer } from "@/components/ui/reveal";
import { JsonLd } from "@/components/seo/json-ld";
import { productSchema, breadcrumbSchema } from "@/lib/seo";

// PDP pulls the live product (and related items) from the admin catalogue.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await productService.getActiveBySlug(slug);
  if (!res.ok) return { title: "Not Found" };
  const product = res.value;
  const title =
    product.seo?.metaTitle ||
    `${product.name} — Certified Natural Gemstone | Buy Online`;
  const description =
    product.seo?.metaDescription ||
    `Buy ${product.name} online — ${product.shortDescription} 100% certified natural, lab-tested and astrologically energised. Free shipping across India.`;
  return {
    title,
    description,
    keywords: product.seo?.keywords ?? [
      product.name,
      `buy ${product.name} online`,
      `certified ${product.name}`,
      "natural gemstone",
      "certified gemstone India",
    ],
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: product.seo?.ogImage || product.image }],
    },
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
      <JsonLd
        data={[
          productSchema({
            name: product.name,
            slug: product.slug,
            description: product.shortDescription,
            image: product.image,
            price: product.price,
            currency: product.currency,
            rating: product.rating,
            reviews: product.reviews,
            inStock: product.inStock,
            sku: product.sku,
            brand: product.brand,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            { name: product.name, path: `/product/${product.slug}` },
          ]),
        ]}
      />
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
