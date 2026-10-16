import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { productService } from "@/modules/products";
import { categoryService } from "@/modules/categories";
import type { ProductCategory, ZodiacSign } from "@/types";

export const metadata: Metadata = {
  title: "Shop Gemstones — Astrounkle",
  description:
    "Browse certified natural gemstones, rings, pendants and loose stones. Filter by category or zodiac sign.",
};

// Shop pulls the live catalogue + categories from the admin.
export const dynamic = "force-dynamic";

const validCategories: ProductCategory[] = [
  "rings",
  "pendants",
  "bracelets",
  "loose-stones",
  "rudraksha",
];

const validZodiac: ZodiacSign[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; zodiac?: string; sale?: string }>;
}) {
  const { category, zodiac, sale } = await searchParams;

  const initialCategory = validCategories.includes(category as ProductCategory)
    ? (category as ProductCategory)
    : undefined;

  const initialZodiac = validZodiac.includes(zodiac as ZodiacSign)
    ? (zodiac as ZodiacSign)
    : undefined;

  const initialSale = sale === "true";

  // Live catalogue + categories (active only) from the admin.
  const [productsRes, categoriesRes] = await Promise.all([
    productService.listActive(),
    categoryService.list(),
  ]);
  const products = productsRes.ok ? productsRes.value : [];
  const categories = (categoriesRes.ok ? categoriesRes.value : [])
    .filter((c) => (c.status ?? "active") === "active")
    .map((c) => ({ slug: c.slug, title: c.title }));

  return (
    <ShopView
      key={`${initialCategory ?? "all"}-${initialZodiac ?? "all"}-${initialSale}`}
      products={products}
      categories={categories}
      initialCategory={initialCategory}
      initialZodiac={initialZodiac}
      initialSale={initialSale}
    />
  );
}
