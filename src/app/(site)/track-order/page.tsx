import type { Metadata } from "next";
import { TrackOrderView } from "@/components/support/track-order-view";

export const metadata: Metadata = {
  title: "Track Your Order — Astrounkle",
  description: "Enter your order ID to see the live status of your gemstone delivery.",
};

export default function TrackOrderPage() {
  return <TrackOrderView />;
}
