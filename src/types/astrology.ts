/** Response shapes for the storefront astrology tools (kundli + matching). */

import type { KundliResult } from "@/lib/astrology/vedic";
import type { GunMilanResult } from "@/lib/astrology/gun-milan";
import type { PlanetGem, Rudraksha } from "@/lib/astrology/gemstones";
import type { DoshaResult } from "@/lib/astrology/doshas";

export interface KundliResponse {
  name: string;
  place: string;
  country: string;
  kundli: KundliResult;
}

export interface MatchingResponse {
  boy: { name: string; moonSign: string; nakshatra: string; place: string };
  girl: { name: string; moonSign: string; nakshatra: string; place: string };
  result: GunMilanResult;
}

export interface GemProductRef {
  slug: string;
  name: string;
  image: string;
  price: number;
  mrp: number;
  rating: number;
}

export interface GemInfo extends PlanetGem {
  basis: string;
  product: GemProductRef | null;
}

export interface ReportResponse {
  name: string;
  place: string;
  country: string;
  ascendant: KundliResult["ascendant"];
  moonSign: KundliResult["moonSign"];
  sunSign: KundliResult["sunSign"];
  nakshatra: KundliResult["nakshatra"];
  planets: KundliResult["planets"];
  gemstones: { life: GemInfo; lucky: GemInfo; benefic: GemInfo };
  rudraksha: Rudraksha;
  doshas: {
    manglik: DoshaResult;
    kaalSarp: DoshaResult;
    sadeSati: DoshaResult;
    pitraDosh: DoshaResult;
  };
}
