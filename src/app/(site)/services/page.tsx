import type { Metadata } from "next";
import { serviceService, serviceCategoryService } from "@/modules/services";
import { ServicesView } from "@/components/services/services-view";

export const metadata: Metadata = {
  title: "Online Astrology Consultation & Vedic Services in India",
  description:
    "Book an online astrology consultation with the best Vedic astrologers in India — kundli analysis, kundli matching, gemstone consultation, career, marriage & medical astrology, vastu, muhurat and numerology over call or video.",
  keywords: [
    "online astrology consultation",
    "vedic astrology consultation",
    "consult astrologer online",
    "best astrologer in India",
    "kundli analysis",
    "kundli matching",
    "marriage astrology consultation",
    "career astrology consultation",
    "gemstone consultation",
    "astrology phone consultation",
    "astrology video consultation",
  ],
  alternates: { canonical: "/services" },
};

// Services are admin-managed — always render the latest active set.
export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const sp = await searchParams;
  const [res, cats] = await Promise.all([
    serviceService.listActive(),
    // A category failure must never take the services page down.
    serviceCategoryService.listPublic().catch(() => []),
  ]);
  const services = res.ok ? res.value : [];
  // Only show chips that actually have something to show.
  const used = new Set(services.map((s) => s.categoryId).filter(Boolean));
  const categories = cats.filter((c) => used.has(c.id)).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const initial = categories.some((c) => c.slug === raw) ? raw! : null;
  return <ServicesView services={services} categories={categories} initialCategory={initial} />;
}
