import type { Metadata } from "next";
import { AskAstrologerView } from "@/components/support/ask-astrologer-view";
import { askAstrologerFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Ask an Astrologer Online — Get a Written Answer in 24 Hours",
  description:
    "Ask any question and get a personalised, written answer from a certified Vedic astrologer online within 24 hours. Expert guidance on career, marriage, love, health, finance and gemstone remedies.",
  keywords: [
    "ask an astrologer online",
    "ask astrologer free",
    "talk to astrologer online",
    "online astrology consultation",
    "astrology question answer",
    "vedic astrologer online",
    "best astrologer in India",
  ],
  alternates: { canonical: "/ask-astrologer" },
};

export default function AskAstrologerPage() {
  return (
    <>
      <JsonLd
        data={[
          faqSchema(askAstrologerFaqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Ask the Astrologer", path: "/ask-astrologer" },
          ]),
        ]}
      />
      <AskAstrologerView />
    </>
  );
}
