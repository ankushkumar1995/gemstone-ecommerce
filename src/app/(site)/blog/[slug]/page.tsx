import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/modules/blog";
import { BlogDetailView } from "@/components/blog/blog-detail-view";
import { JsonLd } from "@/components/seo/json-ld";
import { articleSchema, breadcrumbSchema } from "@/lib/seo";

// Dynamic (admin-managed): render whatever is published right now.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await articleService.getPublishedBySlug(slug);
  if (!res.ok) return { title: "Article Not Found" };
  const article = res.value;
  const title = article.seo?.metaTitle || article.title;
  const description = article.seo?.metaDescription || article.excerpt;
  return {
    title,
    description,
    keywords: article.tags,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: article.date,
      modifiedTime: article.updatedAt || article.date,
      authors: [article.author],
      tags: article.tags,
      images: [{ url: article.seo?.ogImage || article.image }],
    },
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

  const article = res.value;
  const [relatedRes, allRes] = await Promise.all([
    articleService.related(slug),
    articleService.listPublished(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          articleSchema({
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            image: article.image,
            category: article.category,
            publishedAt: article.date,
            updatedAt: article.updatedAt,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: article.title, path: `/blog/${article.slug}` },
          ]),
        ]}
      />
      <BlogDetailView
        article={article}
        related={relatedRes.ok ? relatedRes.value : []}
        allArticles={allRes.ok ? allRes.value : []}
      />
    </>
  );
}
