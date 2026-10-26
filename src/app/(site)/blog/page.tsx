import type { Metadata } from "next";
import { articleService } from "@/modules/blog";
import { BlogListView } from "@/components/blog/blog-list-view";

export const metadata: Metadata = {
  title: "Astrology & Gemstone Blog — Vedic Guides & Remedies",
  description:
    "Expert guides on Vedic astrology, gemstones, planets, zodiac signs and remedies. Learn which gemstone suits your rashi, how to read your kundli and more — from Astrounkle's astrologers.",
  keywords: [
    "astrology blog",
    "gemstone guide",
    "which gemstone for my zodiac",
    "vedic remedies",
    "rashi gemstone",
    "blue sapphire benefits",
    "yellow sapphire benefits",
    "astrology tips",
  ],
  alternates: { canonical: "/blog" },
};

// Blog is now dynamic (admin-managed) — always render the latest published set.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const res = await articleService.listPublished();
  const articles = res.ok ? res.value : [];
  const categories = Array.from(new Set(articles.map((a) => a.category)));
  return <BlogListView articles={articles} categories={categories} />;
}
