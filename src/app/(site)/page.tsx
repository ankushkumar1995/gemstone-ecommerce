import { Hero } from "@/components/sections/hero";
import { TrustBand } from "@/components/sections/trust-band";
import { Categories } from "@/components/sections/categories";
import { About } from "@/components/sections/about";
import { CollectionTabs } from "@/components/sections/collection-tabs";
import { ShopByZodiac } from "@/components/sections/shop-by-zodiac";
import { ShopByPlanet } from "@/components/sections/shop-by-planet";
import { PromoBanner } from "@/components/sections/promo-banner";
import { HowItWorks } from "@/components/sections/how-it-works";
import { WhyBuy } from "@/components/sections/why-buy";
import { ZodiacFinder } from "@/components/sections/zodiac-finder";
import { ConsultationCta } from "@/components/sections/consultation-cta";
import { ServicesPreview } from "@/components/sections/services-preview";
import { FreeTools } from "@/components/sections/free-tools";
import { Astrologers } from "@/components/sections/astrologers";
import { AskAstrologerCta } from "@/components/sections/ask-astrologer-cta";
import { ConsultationPricing } from "@/components/sections/consultation-pricing";
import { FreeConsultation } from "@/components/sections/free-consultation";
import { Testimonials } from "@/components/sections/testimonials";
import { BlogPreview } from "@/components/sections/blog-preview";
import { Newsletter } from "@/components/sections/newsletter";
import type { Metadata } from "next";
import { articleService } from "@/modules/blog";
import { bannerService } from "@/modules/banners";
import { productService } from "@/modules/products";
import { categoryService } from "@/modules/categories";
import { serviceService } from "@/modules/services";

// Home uses the brand default title/description from the root layout; we only
// pin the canonical here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Homepage pulls live blog, banner, product + category content from the admin.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [blogRes, bannerRes, productsRes, categoriesRes, servicesRes] = await Promise.all([
    articleService.listPublished(),
    bannerService.forPlacement("promo"),
    productService.listActive(),
    categoryService.list(),
    serviceService.listActive(),
  ]);
  const latestArticles = (blogRes.ok ? blogRes.value : []).slice(0, 3);
  const promoBanner = bannerRes.ok && bannerRes.value[0] ? bannerRes.value[0] : null;
  const products = productsRes.ok ? productsRes.value : [];
  const categories = (categoriesRes.ok ? categoriesRes.value : []).filter(
    (c) => (c.status ?? "active") === "active",
  );
  const services = servicesRes.ok ? servicesRes.value : [];
  return (
    <>
      <Hero />
      <TrustBand />
      <Categories categories={categories} />
      <CollectionTabs products={products} />
      <ServicesPreview services={services} />
      <FreeTools />
      <Astrologers />
      <AskAstrologerCta />
      <ConsultationPricing />
      <FreeConsultation />
      <About />
      <ShopByZodiac />
      <ShopByPlanet />
      <PromoBanner banner={promoBanner} />
      <HowItWorks />
      <WhyBuy />
      <ZodiacFinder />
      <ConsultationCta />
      <Testimonials />
      <BlogPreview articles={latestArticles} />
      <Newsletter />
    </>
  );
}
