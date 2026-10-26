import type { Metadata } from "next";
import { TrackOrderView } from "@/components/support/track-order-view";

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Enter your order ID to see the live status of your certified gemstone delivery from Astrounkle.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderPage() {
  return <TrackOrderView />;
}
