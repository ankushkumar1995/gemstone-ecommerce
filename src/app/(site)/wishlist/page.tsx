import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
  title: "Your Wishlist — Astrounkle",
  description: "Your saved gemstones. Move them to the cart whenever you're ready.",
};

export default function WishlistPage() {
  return <WishlistView />;
}
