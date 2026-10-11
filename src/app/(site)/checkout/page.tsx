import type { Metadata } from "next";
import { CheckoutView } from "@/components/cart/checkout-view";

export const metadata: Metadata = {
  title: "Checkout — Nakshatra",
  description: "Complete your gemstone purchase securely.",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
