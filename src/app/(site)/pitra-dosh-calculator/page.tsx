import type { Metadata } from "next";
import { PitraDoshView } from "@/components/astrology/pitra-dosh-view";
import { pitraDoshFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pitra Dosh Calculator — Check Pitra Dosha Free by Date of Birth",
  description:
    "Free Pitra Dosh calculator. Check your kundli for Pitra Dosha (ancestral karmic debt) by date of birth, see how it forms and learn the Shraddh, Tarpan and Pind Daan remedies.",
  keywords: [
    "pitra dosh calculator",
    "pitra dosha check",
    "pitru dosh calculator",
    "pitra dosh in kundli",
    "ancestral dosha",
    "pitra dosh remedies",
  ],
  alternates: { canonical: "/pitra-dosh-calculator" },
};

export default function PitraDoshPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Pitra Dosh Calculator", path: "/pitra-dosh-calculator", description: "Free Pitra Dosha checker by date of birth." }),
        faqSchema(pitraDoshFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Pitra Dosh Calculator", path: "/pitra-dosh-calculator" }]),
      ]} />
      <PitraDoshView />
    </>
  );
}
