import type { Metadata } from "next";
import { KundliMatchingView } from "@/components/astrology/kundli-matching-view";
import { matchingFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free Kundli Matching for Marriage — Gun Milan Online",
  description:
    "Free online kundli matching for marriage by Ashtakoot Gun Milan. Check marriage compatibility and get your score out of 36 gunas across all 8 kootas — Varna, Vashya, Tara, Yoni, Gana, Bhakoot, Nadi and more.",
  keywords: [
    "kundli matching",
    "kundli matching for marriage",
    "gun milan",
    "horoscope matching",
    "kundali milan",
    "gun milan by name",
    "ashtakoot milan",
    "marriage compatibility calculator",
    "match making calculator",
    "free kundli matching online",
    "nadi dosha",
    "bhakoot dosha",
  ],
  alternates: { canonical: "/kundli-matching" },
};

export default function KundliMatchingPage() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema({
            name: "Free Kundli Matching — Gun Milan Calculator",
            path: "/kundli-matching",
            description:
              "Free online Ashtakoot Gun Milan kundli matching calculator for marriage compatibility.",
          }),
          faqSchema(matchingFaqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Kundli Matching", path: "/kundli-matching" },
          ]),
        ]}
      />
      <KundliMatchingView />
    </>
  );
}
