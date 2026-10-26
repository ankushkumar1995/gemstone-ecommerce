import type { Metadata } from "next";
import { FaqView } from "@/components/support/faq-view";
import { gemstoneFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Gemstone & Astrology FAQs",
  description:
    "Answers to common questions about certified natural gemstones, authenticity, lab certification, energisation, shipping, returns and astrology consultations.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={[
          faqSchema(gemstoneFaqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "FAQs", path: "/faq" },
          ]),
        ]}
      />
      <FaqView />
    </>
  );
}
