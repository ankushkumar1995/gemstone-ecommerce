import type { Metadata } from "next";
import { PoliciesView } from "@/components/support/policies-view";

export const metadata: Metadata = {
  title: "Policies — Nakshatra",
  description: "Shipping, returns, buyback, privacy and terms for shopping at Nakshatra.",
};

export default function PoliciesPage() {
  return <PoliciesView />;
}
