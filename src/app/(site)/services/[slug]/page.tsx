import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceService } from "@/modules/services";
import { ServiceDetailView } from "@/components/services/service-detail-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await serviceService.getActiveBySlug(slug);
  if (!res.ok) return { title: "Service Not Found — Astrounkle" };
  return {
    title: `${res.value.title} — Astrology Services | Astrounkle`,
    description: res.value.description,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [res, allRes] = await Promise.all([
    serviceService.getActiveBySlug(slug),
    serviceService.listActive(),
  ]);
  if (!res.ok) notFound();

  return (
    <ServiceDetailView service={res.value} services={allRes.ok ? allRes.value : []} />
  );
}
