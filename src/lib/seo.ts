/**
 * SEO helpers — JSON-LD structured data builders.
 *
 * Structured data (schema.org) helps Google understand the site and can earn
 * rich results (star ratings, FAQ accordions, sitelinks search box, business
 * knowledge panel). Each builder returns a plain object you drop into a
 * <script type="application/ld+json"> tag via the <JsonLd> component.
 */

import { BRAND } from "@/lib/brand";

const BASE = BRAND.url.replace(/\/$/, "");

/** Organization schema — powers the brand knowledge panel. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: BASE,
    logo: `${BASE}/images/image1.png`,
    description: BRAND.metaDescription,
    email: BRAND.email,
    sameAs: Object.values(BRAND.socials).filter(Boolean),
  };
}

/** WebSite schema — enables the Google Sitelinks Search Box. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}/#website`,
    url: BASE,
    name: BRAND.name,
    description: BRAND.metaDescription,
    publisher: { "@id": `${BASE}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * ProfessionalService schema — describes the astrology consultation business
 * so it can surface for "astrologer near me" / local + service queries.
 */
export function astrologyServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${BASE}/#astrology-service`,
    name: `${BRAND.name} — Online Astrology Consultation`,
    url: `${BASE}/services`,
    description:
      "Online Vedic astrology consultation with certified astrologers for career, marriage, health, finance and gemstone guidance across India and worldwide.",
    image: `${BASE}/images/image1.png`,
    priceRange: "₹₹",
    areaServed: ["India", "United States", "United Kingdom", "UAE", "Singapore", "Australia"],
    serviceType: [
      "Vedic astrology consultation",
      "Kundli analysis",
      "Kundli matching",
      "Gemstone consultation",
      "Marriage astrology",
      "Career astrology",
      "Medical astrology",
      "Numerology",
    ],
    provider: { "@id": `${BASE}/#organization` },
  };
}

/** FAQPage schema — can surface an expandable FAQ right in search results. */
export function faqSchema(faqs: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/**
 * Product schema — enables price, availability and star-rating rich results
 * for gemstone product pages.
 */
export function productSchema(p: {
  name: string;
  slug: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
  rating?: number;
  reviews?: number;
  inStock?: boolean;
  sku?: string;
  brand?: string;
}) {
  const url = `${BASE}/product/${p.slug}`;
  const image = p.image?.startsWith("http") ? p.image : `${BASE}${p.image}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image,
    url,
    sku: p.sku || p.slug,
    brand: { "@type": "Brand", name: p.brand || BRAND.name },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: p.currency || "INR",
      price: p.price,
      availability: p.inStock === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: { "@id": `${BASE}/#organization` },
    },
    ...(p.rating && p.reviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.rating,
            reviewCount: p.reviews,
          },
        }
      : {}),
  };
}

/** Service schema — for individual astrology service pages (with price). */
export function serviceSchema(s: {
  title: string;
  slug: string;
  description: string;
  priceFrom: number;
  currency?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.title,
    description: s.description,
    url: `${BASE}/services/${s.slug}`,
    serviceType: "Astrology Consultation",
    provider: { "@id": `${BASE}/#organization` },
    areaServed: ["India", "Worldwide"],
    ...(s.priceFrom > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: s.currency || "INR",
            price: s.priceFrom,
          },
        }
      : {}),
  };
}

/** Article / BlogPosting schema — for blog post rich results. */
export function articleSchema(a: {
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  category?: string;
  publishedAt?: string;
  updatedAt?: string;
}) {
  const url = `${BASE}/blog/${a.slug}`;
  const image = a.image?.startsWith("http") ? a.image : `${BASE}${a.image}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.excerpt,
    image,
    url,
    mainEntityOfPage: url,
    articleSection: a.category,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt || a.publishedAt,
    author: { "@type": "Organization", name: BRAND.name, url: BASE },
    publisher: { "@id": `${BASE}/#organization` },
  };
}

/** WebApplication schema — for free interactive tools (kundli, matching). */
export function toolSchema(t: { name: string; path: string; description: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t.name,
    url: `${BASE}${t.path}`,
    description: t.description,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: 0, priceCurrency: "INR" },
    provider: { "@id": `${BASE}/#organization` },
  };
}

/** BreadcrumbList schema — renders a breadcrumb trail under the search result. */
export function breadcrumbSchema(items: ReadonlyArray<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${BASE}${it.path}`,
    })),
  };
}
