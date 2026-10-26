import type { Metadata } from "next";
import { DoshaView } from "@/components/astrology/dosha-view";
import { doshaFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free Dosha Checker — Manglik, Kaal Sarp & Sade Sati",
  description:
    "Check your kundli for Manglik (Mangal) dosha, Kaal Sarp dosha and Sade Sati free by date of birth. Know which doshas apply to you, what they mean, and their remedies.",
  keywords: [
    "manglik dosha calculator",
    "mangal dosha check",
    "kaal sarp dosha calculator",
    "sade sati calculator",
    "dosha checker",
    "am I manglik",
    "kundli dosha check",
  ],
  alternates: { canonical: "/dosha-checker" },
};

export default function DoshaPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Dosha Checker", path: "/dosha-checker", description: "Free Manglik, Kaal Sarp and Sade Sati dosha checker by date of birth." }),
        faqSchema(doshaFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Dosha Checker", path: "/dosha-checker" }]),
      ]} />
      <DoshaView />
    </>
  );
}
