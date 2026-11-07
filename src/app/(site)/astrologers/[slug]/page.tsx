import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { astrologerService } from "@/modules/astrologers";
import { BRAND } from "@/lib/brand";
import { AstrologerProfileView } from "@/components/astrologers/profile-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await astrologerService.getPublic((await params).slug);
  if (!res.ok) return { title: "Astrologer not found", robots: { index: false } };
  const a = res.value;
  const description = a.shortBio ?? `${a.displayName}: ${a.expertise.slice(0, 3).join(", ")} astrologer with ${a.experienceYears} years of experience.`;
  return {
    title: `${a.displayName} · ${a.expertise[0] ?? "Astrologer"} · Chat ₹${a.rates.chat}/min`,
    description,
    alternates: { canonical: `/astrologers/${a.slug}` },
    openGraph: { title: a.displayName, description, images: a.photo ? [a.photo] : undefined },
  };
}

export default async function AstrologerProfilePage({ params }: Props) {
  const res = await astrologerService.getPublic((await params).slug);
  if (!res.ok) notFound();
  const a = res.value;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.displayName,
    jobTitle: "Astrologer",
    image: a.photo,
    knowsLanguage: a.languages,
    knowsAbout: a.expertise,
    url: `${BRAND.url}/astrologers/${a.slug}`,
    ...(a.reviewCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: a.rating, reviewCount: a.reviewCount } } : {}),
  };
  return (
    <>
      {/* JSON-LD for rich results. Values come from our own DB; < is escaped to prevent script injection. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <AstrologerProfileView a={a} />
    </>
  );
}
