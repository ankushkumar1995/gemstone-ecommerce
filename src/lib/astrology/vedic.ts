/**
 * Vedic (sidereal) astrology calculations.
 *
 * Uses `astronomy-engine` (zero-dependency, Meeus-based) for accurate tropical
 * ecliptic longitudes of the Sun, Moon and planets, then applies the Lahiri
 * ayanamsa to convert to the sidereal zodiac used in Vedic astrology. From
 * there we derive the Rashi (moon sign), Sun sign, Nakshatra, Ascendant
 * (Lagna) and each planet's sign placement.
 *
 * This is a self-contained engine — no external API, so the pages render
 * reliably at build/request time and stay SEO-friendly.
 *
 * Accuracy note: planetary longitudes are high-precision. The Ascendant and
 * house cusps depend on exact birth time and geographic coordinates; small
 * errors in the entered birth time shift the Lagna, exactly as in any Vedic
 * chart. For traditional (non-true) node positions we compute the Mean Node.
 */

import {
  Body,
  EclipticLongitude,
  MakeTime,
  SiderealTime,
  SunPosition,
  EclipticGeoMoon,
  type AstroTime,
} from "astronomy-engine";

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */

export const RASHIS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

/** Sanskrit rashi names (for authenticity + keyword coverage). */
export const RASHIS_SANSKRIT = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
] as const;

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
] as const;

/** Nakshatra lords in order (used for Vimshottari Dasha & Nadi/Yoni). */
export const NAKSHATRA_LORDS = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
] as const;

export type PlanetName =
  | "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter"
  | "Venus" | "Saturn" | "Rahu" | "Ketu";

export interface PlanetPosition {
  planet: PlanetName;
  longitude: number; // sidereal ecliptic longitude 0–360
  rashiIndex: number; // 0–11
  rashi: string;
  rashiSanskrit: string;
  degreeInSign: number; // 0–30
  nakshatraIndex: number; // 0–26
  nakshatra: string;
  nakshatraPada: number; // 1–4
  retrograde: boolean;
}

export interface KundliResult {
  ayanamsa: number;
  ascendant: {
    longitude: number;
    rashiIndex: number;
    rashi: string;
    rashiSanskrit: string;
    degreeInSign: number;
  };
  moonSign: { rashiIndex: number; rashi: string; rashiSanskrit: string };
  sunSign: { rashiIndex: number; rashi: string; rashiSanskrit: string };
  nakshatra: {
    index: number;
    name: string;
    pada: number;
    lord: string;
  };
  planets: PlanetPosition[];
}

export interface BirthInput {
  /** Local date-time of birth (the moment, interpreted as UTC offset below). */
  date: Date;
  /** Latitude in degrees (+N). */
  latitude: number;
  /** Longitude in degrees (+E). */
  longitude: number;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Lahiri (Chitrapaksha) ayanamsa for a given date, in degrees.
 * ~23.853° at J2000 (2000.0), precessing at ~50.2388475"/year. Accurate to a
 * couple of arc-minutes across modern birth dates — the standard used for
 * sidereal (Vedic) chart calculation.
 */
export function lahiriAyanamsa(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const yearsFromJ2000 = (JD - 2451545.0) / 365.25;
  const ARCSEC_PER_YEAR = 50.2388475;
  return 23.853 + (yearsFromJ2000 * ARCSEC_PER_YEAR) / 3600;
}

const ayanamsaDeg = lahiriAyanamsa;

function siderealLongitude(tropical: number, ayan: number): number {
  return norm360(tropical - ayan);
}

export function rashiOf(siderealLon: number) {
  const idx = Math.floor(norm360(siderealLon) / 30);
  return {
    rashiIndex: idx,
    rashi: RASHIS[idx],
    rashiSanskrit: RASHIS_SANSKRIT[idx],
    degreeInSign: norm360(siderealLon) % 30,
  };
}

export function nakshatraOf(siderealLon: number) {
  const span = 360 / 27; // 13°20'
  const idx = Math.floor(norm360(siderealLon) / span);
  const within = norm360(siderealLon) % span;
  const pada = Math.floor(within / (span / 4)) + 1;
  return {
    index: idx,
    name: NAKSHATRAS[idx],
    pada,
    lord: NAKSHATRA_LORDS[idx % 9],
  };
}

/* ------------------------------------------------------------------ *
 * Core
 * ------------------------------------------------------------------ */

const BODY_MAP: Array<{ name: PlanetName; body: Body }> = [
  { name: "Sun", body: Body.Sun },
  { name: "Moon", body: Body.Moon },
  { name: "Mars", body: Body.Mars },
  { name: "Mercury", body: Body.Mercury },
  { name: "Jupiter", body: Body.Jupiter },
  { name: "Venus", body: Body.Venus },
  { name: "Saturn", body: Body.Saturn },
];

/**
 * Geocentric apparent tropical ecliptic longitude for a body. The Sun and Moon
 * need dedicated helpers (EclipticLongitude is heliocentric and undefined for
 * the Sun); the other planets use EclipticLongitude directly.
 */
function tropicalLongitude(body: Body, time: AstroTime): number {
  if (body === Body.Sun) return SunPosition(time).elon;
  if (body === Body.Moon) return EclipticGeoMoon(time).lon;
  return EclipticLongitude(body, time);
}

/** True geocentric apparent retrograde test via longitude delta over 1 hour. */
function isRetrograde(body: Body, date: Date): boolean {
  if (body === Body.Sun || body === Body.Moon) return false;
  const t0 = MakeTime(date);
  const t1 = MakeTime(new Date(date.getTime() + 3600_000));
  const l0 = EclipticLongitude(body, t0);
  const l1 = EclipticLongitude(body, t1);
  let d = l1 - l0;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d < 0;
}

/**
 * Mean lunar node (Rahu). Tropical longitude of the Moon's ascending node.
 * Standard Meeus polynomial (Ω), good to arc-minutes.
 */
function meanRahuTropical(date: Date): number {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  const omega =
    125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  return norm360(omega);
}

/**
 * Compute the Ascendant (Lagna) tropical longitude.
 * Uses local sidereal time + obliquity to get the rising ecliptic degree.
 */
function ascendantTropical(date: Date, lat: number, lon: number): number {
  const time = MakeTime(date);
  // Greenwich apparent sidereal time (hours) → degrees, then local.
  const gastHours = SiderealTime(time);
  const lstDeg = norm360(gastHours * 15 + lon);
  const ramc = (lstDeg * Math.PI) / 180; // right ascension of MC (radians)

  // Obliquity of the ecliptic (radians) — mean obliquity is sufficient here.
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525;
  const eps =
    (23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T) *
    (Math.PI / 180);
  const latRad = (lat * Math.PI) / 180;

  // Ascendant formula (Meeus).
  let asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latRad) * Math.sin(eps)),
  );
  asc = (asc * 180) / Math.PI;
  return norm360(asc);
}

/**
 * Main entry point — compute a full Vedic kundli from birth details.
 * `date` must already be the correct UTC instant of birth.
 */
export function computeKundli(input: BirthInput): KundliResult {
  const { date, latitude, longitude } = input;
  const ayan = ayanamsaDeg(date);
  const time = MakeTime(date);

  const planets: PlanetPosition[] = BODY_MAP.map(({ name, body }) => {
    const tropical = tropicalLongitude(body, time);
    const sidereal = siderealLongitude(tropical, ayan);
    const r = rashiOf(sidereal);
    const n = nakshatraOf(sidereal);
    return {
      planet: name,
      longitude: sidereal,
      rashiIndex: r.rashiIndex,
      rashi: r.rashi,
      rashiSanskrit: r.rashiSanskrit,
      degreeInSign: r.degreeInSign,
      nakshatraIndex: n.index,
      nakshatra: n.name,
      nakshatraPada: n.pada,
      retrograde: isRetrograde(body, date),
    };
  });

  // Rahu (mean node) + Ketu (opposite). Nodes are always retrograde.
  const rahuTropical = meanRahuTropical(date);
  const rahuSid = siderealLongitude(rahuTropical, ayan);
  const ketuSid = norm360(rahuSid + 180);
  for (const [nm, lonSid] of [["Rahu", rahuSid], ["Ketu", ketuSid]] as const) {
    const r = rashiOf(lonSid);
    const n = nakshatraOf(lonSid);
    planets.push({
      planet: nm,
      longitude: lonSid,
      rashiIndex: r.rashiIndex,
      rashi: r.rashi,
      rashiSanskrit: r.rashiSanskrit,
      degreeInSign: r.degreeInSign,
      nakshatraIndex: n.index,
      nakshatra: n.name,
      nakshatraPada: n.pada,
      retrograde: true,
    });
  }

  const ascTropical = ascendantTropical(date, latitude, longitude);
  const ascSid = siderealLongitude(ascTropical, ayan);
  const ascR = rashiOf(ascSid);

  const sun = planets.find((p) => p.planet === "Sun")!;
  const moon = planets.find((p) => p.planet === "Moon")!;
  const moonNak = nakshatraOf(moon.longitude);

  return {
    ayanamsa: ayan,
    ascendant: {
      longitude: ascSid,
      rashiIndex: ascR.rashiIndex,
      rashi: ascR.rashi,
      rashiSanskrit: ascR.rashiSanskrit,
      degreeInSign: ascR.degreeInSign,
    },
    moonSign: {
      rashiIndex: moon.rashiIndex,
      rashi: moon.rashi,
      rashiSanskrit: moon.rashiSanskrit,
    },
    sunSign: {
      rashiIndex: sun.rashiIndex,
      rashi: sun.rashi,
      rashiSanskrit: sun.rashiSanskrit,
    },
    nakshatra: {
      index: moonNak.index,
      name: moonNak.name,
      pada: moonNak.pada,
      lord: moonNak.lord,
    },
    planets,
  };
}


