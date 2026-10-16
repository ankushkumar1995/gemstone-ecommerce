import type { Metadata } from "next";
import { PoliciesView } from "@/components/support/policies-view";

export const metadata: Metadata = {
  title: "Policies — Astrounkle",
  description: "Shipping, returns, buyback, privacy and terms for shopping at Astrounkle.",
};

export default function PoliciesPage() {
  return <PoliciesView />;
}
