import type { Metadata } from "next";
import { NakshatraView } from "@/components/astrology/nakshatra-view";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Nakshatra Finder — Find Your Birth Star by Date of Birth",
  description:
    "Free Nakshatra (birth star) finder. Discover your Nakshatra and Pada by date, time and place of birth, plus its ruling planet — the basis of your Vimshottari Dasha and kundli matching.",
  keywords: [
    "nakshatra finder",
    "birth star calculator",
    "find my nakshatra",
    "nakshatra by date of birth",
    "janma nakshatra",
    "nakshatra pada calculator",
  ],
  alternates: { canonical: "/nakshatra-finder" },
};

export default function NakshatraPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Nakshatra Finder", path: "/nakshatra-finder", description: "Free Vedic Nakshatra (birth star) finder by date of birth." }),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Nakshatra Finder", path: "/nakshatra-finder" }]),
      ]} />
      <NakshatraView />
    </>
  );
}
