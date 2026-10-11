import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Your Cart — Nakshatra",
  description: "Review the certified gemstones in your cart and proceed to checkout.",
};

export default function CartPage() {
  return <CartView />;
}
