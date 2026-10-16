import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

const BASE = BRAND.url.replace(/\/$/, "");

/**
 * robots.txt — allow public storefront crawling, keep the admin console,
 * API and account/checkout flows out of the index, and point crawlers at the
 * sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/account", "/checkout", "/cart", "/wishlist"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
