import type { Metadata } from "next";
import { poojaService } from "@/modules/poojas";
import { PoojaListing } from "@/components/pooja/pooja-listing";
import { PoojaWhy, PoojaTestimonials } from "@/components/pooja/pooja-why-reviews";

export const metadata: Metadata = {
  title: "Book Online Havan & Yagya | Vedic Anushthan by Expert Pandits",
  description:
    "Book Vedic havan, yagya and anushthan with mantra jaap and ahutis performed in your name. Ekal or samuhik, daily updates, live darshan and havan bhasma delivered home.",
  alternates: { canonical: "/havan" },
};

// Admin-managed catalog and live seat counts.
export const dynamic = "force-dynamic";

export default async function HavanPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const [sp, data] = await Promise.all([searchParams, poojaService.storefrontCards("havan")]);
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const initial = data.categories.find((c) => c.slug === raw)?.key ?? null;
  return (
    <>
      <PoojaListing type="havan" poojas={data.poojas} categories={data.categories} initialCategory={initial} />
      <PoojaWhy type="havan" />
      <PoojaTestimonials type="havan" />
    </>
  );
}
