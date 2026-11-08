import "server-only";

/**
 * Server renderer + metadata shared by /pooja/[slug] and /havan/[slug].
 * Each URL only shows its own type; the other type is redirected to its
 * correct URL, so a havan link can never open as a pooja page (or back).
 */

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { poojaService, type RitualType } from "@/modules/poojas";
import { PoojaDetail } from "@/components/pooja/pooja-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";

const BASE: Record<RitualType, { path: string; crumb: string; service: string; notFound: string }> = {
  pooja: { path: "/pooja", crumb: "Pooja", service: "Online Pooja", notFound: "Pooja Not Found" },
  havan: { path: "/havan", crumb: "Havan & Yagya", service: "Online Havan / Yagya", notFound: "Havan Not Found" },
};

export async function ritualMetadata(slug: string, type: RitualType): Promise<Metadata> {
  const r = await poojaService.getStorefront(slug).catch(() => null);
  if (!r || !r.ok || r.value.type !== type) return { title: BASE[type].notFound };
  const p = r.value;
  const title = p.seo.title || `${p.title} Online Booking`;
  const description = (p.seo.description || p.shortDescription || p.subtitle || `Book ${p.title} performed in your name.`).slice(0, 170);
  return {
    title,
    description,
    alternates: { canonical: `${BASE[type].path}/${p.slug}` },
    openGraph: { type: "website", title, description, images: p.coverImage ? [{ url: p.coverImage }] : undefined },
  };
}

export async function RitualDetailPage({ slug, type }: { slug: string; type: RitualType }) {
  const r = await poojaService.getStorefront(slug);
  if (!r.ok) notFound();
  const pooja = r.value;
  // Wrong section for this item: send to the right URL (keeps shared links working).
  if (pooja.type !== type) permanentRedirect(`${BASE[pooja.type].path}/${pooja.slug}`);

  const data = await poojaService.storefrontCards(type);
  const category = data.categories.find((c) => c.key === pooja.category) ?? null;
  const next = data.poojas.find((p) => p.id === pooja.id)?.next ?? null;
  // Same category first, then the rest, up to 4 (same type only).
  const others = data.poojas.filter((p) => p.id !== pooja.id);
  const related = [...others.filter((p) => p.category === pooja.category), ...others.filter((p) => p.category !== pooja.category)].slice(0, 4);
  const b = BASE[type];

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: pooja.title,
            description: pooja.shortDescription || pooja.subtitle,
            image: pooja.coverImage || undefined,
            serviceType: b.service,
            offers: { "@type": "Offer", priceCurrency: "INR", price: pooja.priceFrom, availability: "https://schema.org/InStock" },
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: b.crumb, path: b.path },
            { name: pooja.title, path: `${b.path}/${pooja.slug}` },
          ]),
        ]}
      />
      <PoojaDetail key={pooja.id} pooja={pooja} category={category} next={next} related={related} categories={data.categories} />
    </>
  );
}
