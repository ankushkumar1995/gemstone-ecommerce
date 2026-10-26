import type { Metadata } from "next";
import { GemstoneRecoView } from "@/components/astrology/gemstone-reco-view";
import { gemstoneFaqsTool } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Gemstone Recommendation — Which Gemstone Should I Wear?",
  description:
    "Free astrological gemstone recommendation by date of birth. Find out which gemstone you should wear based on your Lagna and Moon sign — then buy a certified, energised stone.",
  keywords: [
    "which gemstone should I wear",
    "gemstone recommendation",
    "gemstone by date of birth",
    "lucky gemstone calculator",
    "astrological gemstone",
    "lucky stone by birth date",
    "life stone astrology",
  ],
  alternates: { canonical: "/gemstone-recommendation" },
};

export default function GemstoneRecoPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Gemstone Recommendation", path: "/gemstone-recommendation", description: "Free astrological gemstone recommendation by date of birth." }),
        faqSchema(gemstoneFaqsTool),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Gemstone Recommendation", path: "/gemstone-recommendation" }]),
      ]} />
      <GemstoneRecoView />
    </>
  );
}
