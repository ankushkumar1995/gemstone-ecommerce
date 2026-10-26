import type { Metadata } from "next";
import { MoonSignView } from "@/components/astrology/moon-sign-view";
import { moonSignFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Moon Sign Calculator — Find Your Rashi by Date of Birth",
  description:
    "Free Moon sign (Rashi) calculator. Find your Vedic Moon sign and Nakshatra by date, time and place of birth. Know your true Rashi — the foundation of Vedic astrology, rashifal and gemstones.",
  keywords: [
    "moon sign calculator",
    "what is my moon sign",
    "rashi calculator",
    "moon sign by date of birth",
    "find my rashi",
    "chandra rashi",
    "vedic moon sign",
  ],
  alternates: { canonical: "/moon-sign-calculator" },
};

export default function MoonSignPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Moon Sign Calculator", path: "/moon-sign-calculator", description: "Free Vedic Moon sign (Rashi) calculator by date of birth." }),
        faqSchema(moonSignFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Moon Sign Calculator", path: "/moon-sign-calculator" }]),
      ]} />
      <MoonSignView />
    </>
  );
}
