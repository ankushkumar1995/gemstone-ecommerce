/**
 * /api/v1/astrology/report
 *   POST → a full "insight" bundle from one set of birth details:
 *     moon sign, sun sign, lagna, nakshatra, a 3-way gemstone recommendation
 *     (life / lucky / benefic) each matched to a real shop product, rudraksha,
 *     and the four doshas (Manglik, Kaal Sarp, Sade Sati, Pitra Dosh).
 *
 * All the chart/sign + gemstone + dosha tools call this one endpoint.
 */

import type { NextRequest } from "next/server";
import { handle, jsonOk, jsonError } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { resolveBirth } from "@/lib/astrology/birth";
import { computeKundli, rashiOf, lahiriAyanamsa } from "@/lib/astrology/vedic";
import {
  PLANET_GEMS,
  gemForRashi,
  beneficGemForLagna,
  PLANET_RUDRAKSHA,
  RASHI_RULER,
  type PlanetGem,
} from "@/lib/astrology/gemstones";
import { checkManglik, checkKaalSarp, checkSadeSati, checkPitraDosh } from "@/lib/astrology/doshas";
import { productService } from "@/modules/products";
import type { Product } from "@/types";
import { Body, EclipticLongitude, MakeTime } from "astronomy-engine";

export const dynamic = "force-dynamic";

/** Current sidereal rashi index of Saturn (for Sade Sati). */
function currentSaturnRashi(): number {
  const now = new Date();
  const tropical = EclipticLongitude(Body.Saturn, MakeTime(now));
  const sidereal = ((tropical - lahiriAyanamsa(now)) % 360 + 360) % 360;
  return rashiOf(sidereal).rashiIndex;
}

/** Trim a product down to the fields the tool card needs. */
function slimProduct(p: Product) {
  return {
    slug: p.slug,
    name: p.name,
    image: p.image,
    price: p.price,
    mrp: p.mrp,
    rating: p.rating,
  };
}

/**
 * Find the best-matching active product for a gemstone recommendation, by
 * matching the gem's name / shop query against product names, descriptions
 * and tags.
 */
function matchProduct(gem: PlanetGem, products: Product[]) {
  const terms = [gem.shopQuery, gem.gem, gem.hindi]
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const scored = products
    .map((p) => {
      const hay = [p.name, p.shortDescription, p.category, ...(p.tags ?? [])]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce((s, t) => (hay.includes(t) ? s + 1 : s), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
  return scored[0] ? slimProduct(scored[0].p) : null;
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonError(AppErrors.validation("Invalid request."));
    }
    const { name, date, time, place } = body as Record<string, string>;
    const resolved = resolveBirth({ date, time, place });
    if ("error" in resolved) return jsonError(AppErrors.validation(resolved.error));

    const k = computeKundli({
      date: resolved.utc,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    });

    // Three-way gemstone recommendation:
    //  • life   — Ascendant (Lagna) lord stone
    //  • lucky  — Moon-sign lord stone
    //  • benefic— trine (5th/9th) lord stone = most auspicious "yoga" stone
    const lagnaRuler = RASHI_RULER[k.ascendant.rashiIndex];
    const lifeGem = PLANET_GEMS[lagnaRuler];
    const luckyGem = gemForRashi(k.moonSign.rashiIndex);
    const benefic = beneficGemForLagna(k.ascendant.rashiIndex);
    const rudraksha = PLANET_RUDRAKSHA[lagnaRuler];

    // Match each recommended stone to a real product in the live catalogue.
    const listRes = await productService.listActive();
    const products = listRes.ok ? listRes.value : [];

    const saturnRashi = currentSaturnRashi();

    return jsonOk({
      name: (name || "").trim() || "You",
      place: resolved.city.name,
      country: resolved.city.country,
      ascendant: k.ascendant,
      moonSign: k.moonSign,
      sunSign: k.sunSign,
      nakshatra: k.nakshatra,
      planets: k.planets,
      gemstones: {
        life: { ...lifeGem, basis: `Ascendant lord (${lagnaRuler})`, product: matchProduct(lifeGem, products) },
        lucky: { ...luckyGem, basis: `Moon-sign lord`, product: matchProduct(luckyGem, products) },
        benefic: {
          ...benefic.gem,
          basis: `${benefic.house}th-house (trine) lord — your most auspicious stone`,
          product: matchProduct(benefic.gem, products),
        },
      },
      rudraksha,
      doshas: {
        manglik: checkManglik(k),
        kaalSarp: checkKaalSarp(k),
        sadeSati: checkSadeSati(k.moonSign.rashiIndex, saturnRashi),
        pitraDosh: checkPitraDosh(k),
      },
    });
  }, request);
}
