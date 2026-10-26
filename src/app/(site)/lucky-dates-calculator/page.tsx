import type { Metadata } from "next";
import { LuckyDatesView } from "@/components/astrology/lucky-dates-view";
import { luckyDatesFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Lucky Dates & Number Calculator — Free Numerology by Date of Birth",
  description:
    "Free lucky dates calculator. Find your lucky dates, Mulank (root number), Bhagyank (destiny number), ruling planet and lucky colour from your date of birth using Vedic numerology.",
  keywords: [
    "lucky dates calculator",
    "lucky number calculator",
    "mulank calculator",
    "bhagyank calculator",
    "numerology by date of birth",
    "lucky number by date of birth",
    "destiny number calculator",
  ],
  alternates: { canonical: "/lucky-dates-calculator" },
};

export default function LuckyDatesPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Lucky Dates & Number Calculator", path: "/lucky-dates-calculator", description: "Free Vedic numerology lucky dates and number calculator." }),
        faqSchema(luckyDatesFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Lucky Dates Calculator", path: "/lucky-dates-calculator" }]),
      ]} />
      <LuckyDatesView />
    </>
  );
}
