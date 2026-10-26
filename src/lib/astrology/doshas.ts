/**
 * Dosha detection from a computed kundli — Manglik (Mangal), Kaal Sarp and
 * Sade Sati. Each returns a clear present/absent verdict with an explanation,
 * suitable for the free dosha-checker tools.
 *
 * These use house positions relative to the Ascendant (Lagna). House = the
 * sign-distance from the Lagna sign (1-based).
 */

import type { KundliResult } from "./vedic";

function houseFrom(referenceRashi: number, planetRashi: number): number {
  return ((planetRashi - referenceRashi + 12) % 12) + 1; // 1..12
}

export interface DoshaResult {
  present: boolean;
  title: string;
  verdict: string;
  explanation: string;
}

/* ----------------------------- Manglik -------------------------------- */
/**
 * Mangal (Manglik) dosha: Mars in house 1, 2, 4, 7, 8 or 12 from the Lagna
 * (and traditionally also from the Moon / Venus). We check from both Lagna and
 * Moon, which is the common practice.
 */
export function checkManglik(k: KundliResult): DoshaResult {
  const mars = k.planets.find((p) => p.planet === "Mars")!;
  const manglikHouses = [1, 2, 4, 7, 8, 12];

  const fromLagna = houseFrom(k.ascendant.rashiIndex, mars.rashiIndex);
  const fromMoon = houseFrom(k.moonSign.rashiIndex, mars.rashiIndex);

  const byLagna = manglikHouses.includes(fromLagna);
  const byMoon = manglikHouses.includes(fromMoon);
  const present = byLagna || byMoon;

  return {
    present,
    title: "Manglik (Mangal) Dosha",
    verdict: present
      ? byLagna && byMoon
        ? "Manglik (from both Lagna and Moon)"
        : "Manglik (partial)"
      : "Non-Manglik",
    explanation: present
      ? `Mars sits in house ${byLagna ? fromLagna : fromMoon} from the ${byLagna ? "Ascendant" : "Moon"}, which forms Mangal dosha. This is often linked to delays or friction in marriage, but it can be matched with another Manglik or balanced with remedies — an astrologer's review is advised.`
      : "Mars does not fall in any of the Manglik houses (1, 2, 4, 7, 8, 12) from the Ascendant or Moon, so no Mangal dosha is formed.",
  };
}

/* ---------------------------- Kaal Sarp ------------------------------- */
/**
 * Kaal Sarp dosha: all seven planets (Sun…Saturn) are hemmed between Rahu and
 * Ketu (i.e. on one side of the Rahu–Ketu axis).
 */
export function checkKaalSarp(k: KundliResult): DoshaResult {
  const rahu = k.planets.find((p) => p.planet === "Rahu")!;
  const ketu = k.planets.find((p) => p.planet === "Ketu")!;
  const others = k.planets.filter(
    (p) => !["Rahu", "Ketu"].includes(p.planet),
  );

  // Normalise everything to an arc starting at Rahu; check if all planets fall
  // within the Rahu→Ketu half (0–180°).
  const rel = (lon: number) => ((lon - rahu.longitude + 360) % 360);
  const allWithin = others.every((p) => rel(p.longitude) <= 180);
  const allOutside = others.every((p) => rel(p.longitude) >= 180);
  const present = allWithin || allOutside;
  void ketu;

  return {
    present,
    title: "Kaal Sarp Dosha",
    verdict: present ? "Kaal Sarp Dosha present" : "No Kaal Sarp Dosha",
    explanation: present
      ? "All seven planets fall on one side of the Rahu–Ketu axis, forming Kaal Sarp Dosha. It can bring ups and downs and delays, but its intensity varies and it has well-known remedies (puja, mantra). A detailed reading is recommended."
      : "The planets are distributed on both sides of the Rahu–Ketu axis, so Kaal Sarp Dosha is not formed in the chart.",
  };
}

/* ---------------------------- Pitra Dosh ------------------------------ */
/**
 * Pitra Dosha (ancestral karmic debt): classically indicated when the Sun or
 * Moon is conjunct/afflicted by Rahu or Ketu, or when Rahu/Ketu/Saturn sit in
 * the 9th house (house of father/ancestors) from the Lagna. We flag it when
 * either condition is met.
 */
export function checkPitraDosh(k: KundliResult): DoshaResult {
  const sun = k.planets.find((p) => p.planet === "Sun")!;
  const moon = k.planets.find((p) => p.planet === "Moon")!;
  const rahu = k.planets.find((p) => p.planet === "Rahu")!;
  const ketu = k.planets.find((p) => p.planet === "Ketu")!;
  const saturn = k.planets.find((p) => p.planet === "Saturn")!;

  // Luminary conjunct a node (same sign).
  const sunNode = sun.rashiIndex === rahu.rashiIndex || sun.rashiIndex === ketu.rashiIndex;
  const moonNode = moon.rashiIndex === rahu.rashiIndex || moon.rashiIndex === ketu.rashiIndex;

  // 9th house (father/ancestors) from Lagna occupied by Rahu/Ketu/Saturn.
  const ninthRashi = (k.ascendant.rashiIndex + 8) % 12;
  const ninthAfflicted = [rahu, ketu, saturn].some((p) => p.rashiIndex === ninthRashi);

  const reasons: string[] = [];
  if (sunNode) reasons.push("the Sun is conjunct a lunar node (Rahu/Ketu)");
  if (moonNode) reasons.push("the Moon is conjunct a lunar node");
  if (ninthAfflicted) reasons.push("Rahu, Ketu or Saturn occupies the 9th house of ancestors");

  const present = reasons.length > 0;
  return {
    present,
    title: "Pitra Dosha",
    verdict: present ? "Pitra Dosha indicated" : "No Pitra Dosha indicated",
    explanation: present
      ? `Pitra Dosha is indicated because ${reasons.join(", and ")}. It relates to unresolved ancestral karma and is traditionally eased with Shraddh, Tarpan and Pind Daan rituals. An astrologer can confirm the severity and the right remedy.`
      : "The Sun, Moon and 9th house (house of ancestors) are free of the classic Rahu/Ketu/Saturn afflictions, so no clear Pitra Dosha is formed in the chart.",
  };
}

/* ---------------------------- Sade Sati ------------------------------- */
/**
 * Sade Sati: the ~7.5-year period when transiting Saturn moves through the
 * 12th, 1st and 2nd signs from the natal Moon sign. We compare the *current*
 * sidereal position of Saturn to the person's Moon sign.
 */
export function checkSadeSati(moonRashiIndex: number, saturnCurrentRashiIndex: number): DoshaResult {
  const house = houseFrom(moonRashiIndex, saturnCurrentRashiIndex); // 1..12
  const phases: Record<number, string> = {
    12: "Rising (first) phase — Saturn in the 12th from your Moon.",
    1: "Peak (second) phase — Saturn over your Moon sign.",
    2: "Setting (third) phase — Saturn in the 2nd from your Moon.",
  };
  const present = house === 12 || house === 1 || house === 2;

  return {
    present,
    title: "Sade Sati",
    verdict: present ? "Sade Sati is running" : "No Sade Sati currently",
    explanation: present
      ? `${phases[house]} Sade Sati is a ~7.5-year Saturn transit that tests patience and discipline. With the right remedies (Shani puja, Blue Sapphire/Neelam on advice, service to the needy) it becomes a period of growth.`
      : "Saturn is not transiting the 12th, 1st or 2nd sign from your Moon, so Sade Sati is not active for you right now.",
  };
}
