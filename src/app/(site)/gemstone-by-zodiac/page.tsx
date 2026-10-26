import type { Metadata } from "next";
import { GemstoneZodiacView } from "@/components/astrology/gemstone-zodiac-view";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Gemstone for Your Zodiac Sign — Lucky Stone by Rashi",
  description:
    "Find the lucky gemstone for every zodiac sign (Rashi). See which gemstone to wear for Aries, Taurus, Gemini and all 12 Vedic Moon signs, with benefits and shopping links.",
  keywords: [
    "gemstone by zodiac sign",
    "lucky gemstone for my rashi",
    "which gemstone for my zodiac",
    "rashi gemstone",
    "zodiac birthstone",
    "lucky stone by sign",
  ],
  alternates: { canonical: "/gemstone-by-zodiac" },
};

export default function GemstoneZodiacPage() {
  return (
    <>
      <JsonLd data={[
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Gemstone by Zodiac", path: "/gemstone-by-zodiac" }]),
      ]} />
      <GemstoneZodiacView />
    </>
  );
}
