import type { Metadata } from "next";
import { ConsultationPage } from "@/components/consultation/consultation-page";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { CONSULTATION_FAQS } from "@/data/consultation-faqs";

export const metadata: Metadata = {
  title: "Online Astrology Consultation | Talk to a Vedic Astrologer",
  description:
    "Book an online astrology consultation with verified Vedic astrologers for career, marriage, love, health and money. Share your birth details and get a call back.",
  alternates: { canonical: "/consultation" },
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: CONSULTATION_FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Consultation", path: "/consultation" },
          ]),
        ]}
      />
      <ConsultationPage faqs={CONSULTATION_FAQS} />
    </>
  );
}
