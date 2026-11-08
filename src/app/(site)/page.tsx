import { Hero } from "@/components/sections/hero";
import { ServicesPreview } from "@/components/sections/services-preview";
import { AboutAstrounkle } from "@/components/sections/about-astrounkle";
import { FreeTools } from "@/components/sections/free-tools";
import { PopularTools } from "@/components/sections/popular-tools";
import { Astrologers } from "@/components/sections/astrologers";
import { AskAstrologerCta } from "@/components/sections/ask-astrologer-cta";
import { ConsultationPricing } from "@/components/sections/consultation-pricing";
import { FreeConsultation } from "@/components/sections/free-consultation";
import { Testimonials } from "@/components/sections/testimonials";
import { BlogPreview } from "@/components/sections/blog-preview";
import { ConsultationBenefits } from "@/components/sections/consultation-benefits";
import type { Metadata } from "next";
import { articleService } from "@/modules/blog";
import { serviceService, serviceCategoryService } from "@/modules/services";
import { poojaService } from "@/modules/poojas";
import { PoojaPreview } from "@/components/sections/pooja-preview";

// Home uses the brand default title/description from the root layout; we only
// pin the canonical here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Homepage pulls live blog + service content from the admin.
export const dynamic = "force-dynamic";

/**
 * Home is astrology-first: consultations, astrologers, free tools and
 * guidance. Shop / gemstone sections (categories, collections, shop by zodiac
 * or planet, stone of the month, why buy, how it works, zodiac stone finder,
 * gemstone newsletter offer) are intentionally not on this page; they still
 * live in their components for the shop pages.
 */
export default async function Home() {
  const [blogRes, servicesRes, cats, poojaData, havanData] = await Promise.all([
    articleService.listPublished(),
    serviceService.listActive(),
    // A category failure must never take the homepage down.
    serviceCategoryService.listPublic().catch(() => []),
    // Empty when the admin has no bookable pooja → the section hides itself.
    poojaService.storefrontCards("pooja"),
    // Same for havans: the section only shows once a havan is live.
    poojaService.storefrontCards("havan"),
  ]);
  const latestArticles = (blogRes.ok ? blogRes.value : []).slice(0, 3);
  const services = servicesRes.ok ? servicesRes.value : [];
  // Only categories that actually have an active service.
  const used = new Set(services.map((s) => s.categoryId).filter(Boolean));
  const categories = cats
    .filter((c) => used.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon }));
  return (
    <>
      <Hero />
      <ServicesPreview services={services} categories={categories} />
      <PoojaPreview poojas={poojaData.poojas} categories={poojaData.categories} />
      <AboutAstrounkle />
      <Astrologers />
      <PoojaPreview type="havan" poojas={havanData.poojas} categories={havanData.categories} />
      <AskAstrologerCta />
      <FreeTools />
      <ConsultationPricing />
      <FreeConsultation />
      <Testimonials />
      <ConsultationBenefits />
      <PopularTools />
      <BlogPreview articles={latestArticles} />
    </>
  );
}
