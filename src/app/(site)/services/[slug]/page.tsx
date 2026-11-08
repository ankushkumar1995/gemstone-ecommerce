import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceService, serviceCategoryService } from "@/modules/services";
import { ServiceDetailView } from "@/components/services/service-detail-view";
import { JsonLd } from "@/components/seo/json-ld";
import { serviceSchema, breadcrumbSchema } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await serviceService.getActiveBySlug(slug);
  if (!res.ok) return { title: "Service Not Found" };
  const s = res.value;
  const title = `${s.title} Online — Book Vedic Astrology Consultation`;
  const description = `${s.tagline} ${s.description}`.slice(0, 160);
  return {
    title,
    description,
    keywords: [
      s.title.toLowerCase(),
      `${s.title.toLowerCase()} online`,
      "online astrology consultation",
      "vedic astrology consultation",
      "best astrologer in India",
      "consult astrologer online",
    ],
    alternates: { canonical: `/services/${s.slug}` },
    openGraph: { type: "website", title, description },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [res, allRes, cats] = await Promise.all([
    serviceService.getActiveBySlug(slug),
    serviceService.listActive(),
    // A category failure must never take the service page down.
    serviceCategoryService.listPublic().catch(() => []),
  ]);
  if (!res.ok) notFound();
  const service = res.value;
  const categories = cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon }));

  return (
    <>
      <JsonLd
        data={[
          serviceSchema({
            title: service.title,
            slug: service.slug,
            description: service.description,
            priceFrom: service.priceFrom,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.title, path: `/services/${service.slug}` },
          ]),
        ]}
      />
      <ServiceDetailView key={service.slug} service={service} services={allRes.ok ? allRes.value : []} categories={categories} />
    </>
  );
}
