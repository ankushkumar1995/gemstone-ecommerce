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
  metaTitle: "Astrounkle — Luxury Gemstones & Astrology",
  /** SEO meta description default. */
  metaDescription:
    "Certified natural gemstones curated by your zodiac, with expert astrological guidance.",
  socials: {
    instagram: "",
    facebook: "",
    youtube: "",
  },
} as const;

export type Brand = typeof BRAND;
