import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageService } from "@/modules/pages";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await pageService.getPublishedBySlug(slug);
  if (!res.ok) return { title: "Page Not Found — Nakshatra" };
  const page = res.value;
  return {
    title: page.seoTitle || `${page.title} — Nakshatra`,
    description: page.seoDescription || undefined,
  };
}

export default async function CmsPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await pageService.getPublishedBySlug(slug);
  if (!res.ok) notFound();
  const page = res.value;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumb items={[{ label: page.title }]} className="mb-6" />
      <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{page.title}</h1>
      <div
        className="blog-content mt-8 max-w-3xl"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </Container>
  );
}
