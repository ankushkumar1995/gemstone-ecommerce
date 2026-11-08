import type { Metadata } from "next";
import { poojaService } from "@/modules/poojas";
import { PoojaListing } from "@/components/pooja/pooja-listing";
import { PoojaWhy, PoojaTestimonials } from "@/components/pooja/pooja-why-reviews";

export const metadata: Metadata = {
  title: "Book Online Pooja | Vedic Puja at Temples & by Expert Pandits",
  description:
    "Book online pooja performed in your name by learned pandits at sacred temples. Sankalp with your name and gotra, pooja video and prasad delivered home.",
  alternates: { canonical: "/pooja" },
};

// Admin-managed catalog and live seat counts.
export const dynamic = "force-dynamic";

export default async function PoojaPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const [sp, data] = await Promise.all([searchParams, poojaService.storefrontCards()]);
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const initial = data.categories.find((c) => c.slug === raw)?.key ?? null;
  return (
    <>
      <PoojaListing poojas={data.poojas} categories={data.categories} initialCategory={initial} />
      <PoojaWhy />
      <PoojaTestimonials />
    </>
  );
}
