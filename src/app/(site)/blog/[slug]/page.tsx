import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/modules/blog";
import { BlogDetailView } from "@/components/blog/blog-detail-view";

// Dynamic (admin-managed): render whatever is published right now.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await articleService.getPublishedBySlug(slug);
  if (!res.ok) return { title: "Article Not Found — Astrounkle" };
  const article = res.value;
  return {
    title: article.seo?.metaTitle || `${article.title} — Astrounkle Journal`,
    description: article.seo?.metaDescription || article.excerpt,
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await articleService.getPublishedBySlug(slug);
  if (!res.ok) notFound();

  const [relatedRes, allRes] = await Promise.all([
    articleService.related(slug),
    articleService.listPublished(),
  ]);

  return (
    <BlogDetailView
      article={res.value}
      related={relatedRes.ok ? relatedRes.value : []}
      allArticles={allRes.ok ? allRes.value : []}
    />
  );
}
