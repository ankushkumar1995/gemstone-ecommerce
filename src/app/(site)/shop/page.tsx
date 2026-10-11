import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import type { ProductCategory, ZodiacSign } from "@/types";

export const metadata: Metadata = {
  title: "Shop Gemstones — Nakshatra",
  description:
    "Browse certified natural gemstones, rings, pendants and loose stones. Filter by category or zodiac sign.",
};

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

  return (
    <ShopView
      key={`${initialCategory ?? "all"}-${initialZodiac ?? "all"}-${initialSale}`}
      initialCategory={initialCategory}
      initialZodiac={initialZodiac}
      initialSale={initialSale}
    />
  );
}
