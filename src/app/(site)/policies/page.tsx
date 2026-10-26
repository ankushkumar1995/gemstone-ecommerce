import type { Metadata } from "next";
import { PoliciesView } from "@/components/support/policies-view";

export const metadata: Metadata = {
  title: "Policies — Shipping, Returns, Buyback & Privacy",
  description:
    "Shipping, returns, lifetime buyback, privacy and terms for buying certified gemstones at Astrounkle.",
  alternates: { canonical: "/policies" },
};

export default function PoliciesPage() {
  return <PoliciesView />;
}
