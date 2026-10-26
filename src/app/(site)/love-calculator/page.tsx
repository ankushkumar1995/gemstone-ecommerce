import type { Metadata } from "next";
import { LoveCalculatorView } from "@/components/astrology/love-calculator-view";
import { loveCalcFaqs } from "@/data/faqs";
import { JsonLd } from "@/components/seo/json-ld";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Love Calculator & FLAMES — Check Love Percentage by Name",
  description:
    "Free love calculator and FLAMES game. Enter two names to get your fun love percentage and FLAMES result. For real astrological compatibility, try Kundli Matching.",
  keywords: [
    "love calculator",
    "flames calculator",
    "love percentage calculator",
    "love calculator by name",
    "flames game",
    "name compatibility",
  ],
  alternates: { canonical: "/love-calculator" },
};

export default function LoveCalculatorPage() {
  return (
    <>
      <JsonLd data={[
        toolSchema({ name: "Love & Flames Calculator", path: "/love-calculator", description: "Fun love percentage and FLAMES calculator by name." }),
        faqSchema(loveCalcFaqs),
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Love Calculator", path: "/love-calculator" }]),
      ]} />
      <LoveCalculatorView />
    </>
  );
}
