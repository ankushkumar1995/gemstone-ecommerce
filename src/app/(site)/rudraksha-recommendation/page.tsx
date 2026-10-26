import type { Metadata } from "next";
import { RudrakshaView } from "@/components/astrology/rudraksha-view";
import { rudrakshaFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Rudraksha Recommendation — Which Mukhi Rudraksha for You?",
  description:
    "Free Rudraksha recommendation by date of birth. Find which mukhi Rudraksha to wear based on your birth chart, with its deity, ruling planet and benefits.",
  keywords: [
    "which rudraksha should I wear",
    "rudraksha recommendation",
    "rudraksha by date of birth",
    "mukhi rudraksha for me",
    "5 mukhi rudraksha",
    "rudraksha benefits",
  ],
  alternates: { canonical: "/rudraksha-recommendation" },
};

export default function RudrakshaPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Rudraksha Recommendation", path: "/rudraksha-recommendation", description: "Free Rudraksha recommendation by date of birth." }),
        faqSchema(rudrakshaFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Rudraksha Recommendation", path: "/rudraksha-recommendation" }]),
      ]} />
      <RudrakshaView />
    </>
  );
}
