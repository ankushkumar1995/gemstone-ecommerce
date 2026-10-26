import type { Metadata } from "next";
import { FreeKundliView } from "@/components/astrology/free-kundli-view";
import { kundliFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free Kundli Online — Janam Kundali by Date of Birth",
  description:
    "Generate your free Janam Kundli (Vedic birth chart) online by date of birth. Get your Lagna, Moon sign (Rashi), Nakshatra and all 9 planetary positions instantly — Lahiri ayanamsa, no sign-up.",
  keywords: [
    "free kundli",
    "janam kundali",
    "free kundli online",
    "kundli by date of birth",
    "online birth chart",
    "janam kundali by date of birth and time",
    "free janam kundali",
    "vedic birth chart",
    "moon sign calculator",
    "rashi calculator",
    "nakshatra finder",
  ],
  alternates: { canonical: "/free-kundli" },
};

export default function FreeKundliPage() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema({
            name: "Free Kundli — Janam Kundali Generator",
            path: "/free-kundli",
            description:
              "Free online Vedic birth chart (Janam Kundli) generator by date of birth.",
          }),
          faqSchema(kundliFaqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Free Kundli", path: "/free-kundli" },
          ]),
        ]}
      />
      <FreeKundliView />
    </>
  );
}
