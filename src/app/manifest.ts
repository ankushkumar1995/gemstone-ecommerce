import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Web App Manifest — lets the storefront be installed as a PWA and gives
 * search engines/browsers richer app metadata (name, theme, icons).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — Online Astrology & Certified Gemstones`,
    short_name: BRAND.name,
    description: BRAND.metaDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#5a24bd",
    categories: ["shopping", "lifestyle", "education"],
    icons: [
      {
        src: "/images/image1.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
