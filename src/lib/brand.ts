/**
 * Central brand configuration — the single source of truth for the storefront
 * and admin brand identity. Any user-facing name, domain, email or social
 * handle should reference this object rather than hardcoding "Astrounkle" so a
 * future rebrand is a one-file change.
 *
 * Note: admin-managed settings (store name, support email, phone) still flow
 * through the Settings module at runtime; these values are the build-time
 * defaults / fallbacks and the values used in metadata and seed content.
 */

export const BRAND = {
  /** Display name, one word. */
  name: "Astrounkle",
  /** Legal / full descriptor used in long-form copy. */
  legalName: "Astrounkle",
  /** Primary domain (no protocol). */
  domain: "astrounkle.com",
  /** Canonical site URL (used for metadataBase, sitemap, robots). */
  url: "https://astrounkle.com",
  /** Customer support / care inbox. */
  email: "care@astrounkle.com",
  /** Transactional order inbox. */
  orderEmail: "orders@astrounkle.com",
  /** General support inbox. */
  supportEmail: "support@astrounkle.com",
  /** Admin login default. */
  adminEmail: "admin@astrounkle.com",
  /** Short marketing tagline. */
  tagline: "Certified gemstones, astrologically energised.",
  /** SEO meta title default. */
  metaTitle:
    "Astrounkle — Online Astrology Consultation & Certified Gemstones in India",
  /** SEO meta description default. */
  metaDescription:
    "Consult the best Vedic astrologers online in India for career, marriage, health & finance. Get your free kundli, birth chart analysis and 100% certified natural gemstones — energised and delivered to your door.",
  /**
   * Default SEO keywords. Curated from high-ranking astrology + gemstone
   * search terms. Used across metadata; keep broad head terms first.
   */
  keywords: [
    "online astrology consultation",
    "best astrologer in India",
    "consult astrologer online",
    "vedic astrology consultation",
    "talk to astrologer online",
    "free astrology consultation",
    "kundli online",
    "free kundli",
    "birth chart analysis",
    "kundli matching",
    "moon sign calculator",
    "today horoscope",
    "horoscope 2026",
    "daily horoscope",
    "marriage astrology consultation",
    "career astrology consultation",
    "medical astrology",
    "astrology phone consultation",
    "astrology video consultation",
    "gemstone consultation",
    "certified natural gemstones",
    "buy gemstones online India",
    "blue sapphire online",
    "ruby gemstone",
    "emerald stone",
    "yellow sapphire",
    "gemstone by zodiac sign",
    "astrological gemstone recommendation",
    "energised gemstones",
    "Rahu Ketu remedies",
    "Sade Sati remedies",
    "online puja",
    "vedic remedies",
  ] as string[],
  socials: {
    instagram: "",
    facebook: "",
    youtube: "",
  },
} as const;

export type Brand = typeof BRAND;
