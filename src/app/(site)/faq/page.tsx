import type { Metadata } from "next";
import { FaqView } from "@/components/support/faq-view";

export const metadata: Metadata = {
  title: "FAQs — Nakshatra",
  description: "Answers to common questions about certified gemstones, authenticity, shipping, returns and astrology.",
};

export default function FaqPage() {
  return <FaqView />;
}
