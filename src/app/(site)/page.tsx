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
import { Testimonials } from "@/components/sections/testimonials";
import { BlogPreview } from "@/components/sections/blog-preview";
import { Newsletter } from "@/components/sections/newsletter";
import { articleService } from "@/modules/blog";
import { bannerService } from "@/modules/banners";

// Homepage pulls live blog + banner content from the admin.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [blogRes, bannerRes] = await Promise.all([
    articleService.listPublished(),
    bannerService.forPlacement("promo"),
  ]);
  const latestArticles = (blogRes.ok ? blogRes.value : []).slice(0, 3);
  const promoBanner = bannerRes.ok && bannerRes.value[0] ? bannerRes.value[0] : null;
  return (
    <>
      <Hero />
      <TrustBand />
      <Categories />
      <CollectionTabs />
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
