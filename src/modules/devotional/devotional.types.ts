/**
 * Devotional content (mantras, aarti, chalisa, stotra, vrat katha, bhajan).
 * Fully managed in admin → Mantras & Aarti; the app and website only read
 * published items. `slug` is the stable public id (old app ids like
 * "m-gayatri" are kept as slugs so saved sadhanas and links keep working).
 */

export const DEVOTIONAL_KINDS = ["mantra", "aarti", "chalisa", "stotra", "katha", "bhajan"] as const;
export type DevotionalKind = (typeof DEVOTIONAL_KINDS)[number];
export const KIND_LABEL: Record<DevotionalKind, string> = {
  mantra: "Mantra", aarti: "Aarti", chalisa: "Chalisa", stotra: "Stotra", katha: "Vrat Katha", bhajan: "Bhajan",
};
export type DevotionalStatus = "draft" | "published";
/** Navagraha (for "mantra for your planet" once the kundli engine is connected). */
export const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const;

export interface DevotionalAudio {
  url: string;
  /** S3 key (for replacing / cleaning up). */
  key?: string;
  /** Length of the file in seconds (read in the browser at upload). */
  durationSec: number;
  bytes?: number;
  /** Who sang / recorded it (shown in the app). */
  artist?: string;
  /** Rights note for the team (not shown in the app). */
  license?: string;
}

export interface DevotionalItem {
  id: string;
  slug: string;
  kind: DevotionalKind;
  status: DevotionalStatus;
  title: string;
  /** Title in Devanagari / Hindi. */
  titleHi: string;
  deity: string;
  /** Mantra text (mantra) or first line (others). */
  devanagari: string;
  roman: string;
  meaning: { en: string; hi: string };
  /** One-line description in lists. */
  blurb: string;
  /** Verses / paragraphs (aarti, chalisa, katha). One entry per block. */
  verses: string[];
  benefits: string[];
  /** When it is traditionally chanted ("Mondays, Pradosh"). */
  bestTime: string;
  /** Weekdays (0 = Sunday) for "today's mantra". */
  days: number[];
  planets: string[];
  /** Festival names or keywords this belongs to ("ekadashi", "shivratri"). */
  festivals: string[];
  tags: string[];
  /** Suggested repeat count (1, 11, 21, 108). */
  defaultCount: number;
  /** Seconds for one recitation when there is no audio (timer mode). */
  recitationSec: number;
  audio: DevotionalAudio | null;
  image: string | null;
  featured: boolean;
  /** Lower comes first. */
  order: number;
  plays: number;
  jaapCount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/** List row (no long text). */
export type DevotionalCard = Pick<DevotionalItem, "id" | "slug" | "kind" | "title" | "titleHi" | "deity" | "blurb" | "devanagari" | "roman" | "bestTime" | "days" | "planets" | "festivals" | "defaultCount" | "recitationSec" | "image" | "featured" | "order"> & {
  audio: { url: string; durationSec: number; artist?: string } | null;
  meaning: { en: string; hi: string };
};
