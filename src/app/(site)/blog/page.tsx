import type { Metadata } from "next";
import { articleService } from "@/modules/blog";
import { BlogListView } from "@/components/blog/blog-list-view";

export const metadata: Metadata = {
  title: "The Gemstone Journal — Nakshatra Blog",
  description:
    "Guides, astrology insights and buying tips on gemstones, planets, zodiac and Vedic remedies from Nakshatra's experts.",
};

// Blog is now dynamic (admin-managed) — always render the latest published set.
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const res = await articleService.listPublished();
  const articles = res.ok ? res.value : [];
  const categories = Array.from(new Set(articles.map((a) => a.category)));
  return <BlogListView articles={articles} categories={categories} />;
}
