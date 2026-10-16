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
import { productService } from "@/modules/products";
import { categoryService } from "@/modules/categories";

// Homepage pulls live blog, banner, product + category content from the admin.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [blogRes, bannerRes, productsRes, categoriesRes] = await Promise.all([
    articleService.listPublished(),
    bannerService.forPlacement("promo"),
    productService.listActive(),
    categoryService.list(),
  ]);
  const latestArticles = (blogRes.ok ? blogRes.value : []).slice(0, 3);
  const promoBanner = bannerRes.ok && bannerRes.value[0] ? bannerRes.value[0] : null;
  const products = productsRes.ok ? productsRes.value : [];
  const categories = (categoriesRes.ok ? categoriesRes.value : []).filter(
    (c) => (c.status ?? "active") === "active",
  );
  return (
    <>
      <Hero />
      <TrustBand />
      <Categories categories={categories} />
      <CollectionTabs products={products} />
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
