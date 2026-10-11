/**
 * Astrology services seed. Seeds the services module's repository. The
 * `AstroService` type now lives in `@/types`; re-exported here so existing
 * storefront imports keep working.
 */

import type { AstroService } from "@/types";

export type { AstroService };

export const services: AstroService[] = [
  {
    id: "svc_kundli",
    slug: "kundli-analysis",
    title: "Kundli Analysis",
    tagline: "Your complete birth chart, decoded",
    description:
      "A detailed janam kundli reading covering your planetary positions, dashas and life predictions by an expert Vedic astrologer.",
    icon: "ScrollText",
    priceFrom: 999,
    duration: "45 min",
    popular: true,
    status: "active",
    order: 1,
    features: [
      "Full birth-chart (D1) analysis",
      "Dasha & transit predictions",
      "Career, health & relationship insights",
      "Personalised remedies",
    ],
  },
  {
    id: "svc_gemstone",
    slug: "gemstone-consultation",
    title: "Gemstone Consultation",
    tagline: "Find the stone written in your stars",
    description:
      "Discover which gemstone truly suits your chart, the ideal carat weight, metal and the right muhurat to wear it.",
    icon: "Gem",
    priceFrom: 0,
    duration: "30 min",
    popular: true,
    status: "active",
    order: 2,
    features: [
      "Chart-based stone recommendation",
      "Ideal carat & metal advice",
      "Wearing ritual & muhurat",
      "100% free with any purchase",
    ],
  },
  {
    id: "svc_matching",
    slug: "kundli-matching",
    title: "Kundli Matching",
    tagline: "Guna Milan for a blessed union",
    description:
      "Traditional Ashtakoota (36 guna) compatibility matching for marriage, including Mangal dosha and remedies.",
    icon: "HeartHandshake",
    priceFrom: 1100,
    duration: "40 min",
    status: "active",
    order: 3,
    features: [
      "36-point Guna Milan report",
      "Mangal / Nadi dosha check",
      "Compatibility score & advice",
      "Remedies for doshas",
    ],
  },
  {
    id: "svc_career",
    slug: "career-finance",
    title: "Career & Finance",
    tagline: "Clarity for work and wealth",
    description:
      "Astrological guidance on career direction, job vs business, promotions, and the best periods for financial growth.",
    icon: "TrendingUp",
    priceFrom: 1299,
    duration: "40 min",
    status: "active",
    order: 4,
    features: [
      "Career path analysis",
      "Business vs job guidance",
      "Favourable timing windows",
      "Wealth & investment remedies",
    ],
  },
  {
    id: "svc_vastu",
    slug: "vastu-consultation",
    title: "Vastu Consultation",
    tagline: "Harmonise your home & office",
    description:
      "Vastu analysis of your space to improve energy flow, prosperity and peace — with practical, low-cost corrections.",
    icon: "Home",
    priceFrom: 1999,
    duration: "60 min",
    status: "active",
    order: 5,
    features: [
      "Room-by-room Vastu review",
      "Direction & placement fixes",
      "Remedies without demolition",
      "Prosperity & health focus",
    ],
  },
  {
    id: "svc_muhurat",
    slug: "muhurat-selection",
    title: "Shubh Muhurat",
    tagline: "The right time for every milestone",
    description:
      "Find the most auspicious date and time for marriage, griha pravesh, naming, business launch and more.",
    icon: "CalendarClock",
    priceFrom: 751,
    duration: "20 min",
    status: "active",
    order: 6,
    features: [
      "Personalised auspicious timing",
      "Marriage / griha pravesh / naming",
      "Business & travel muhurat",
      "Based on your chart & panchang",
    ],
  },
  {
    id: "svc_numerology",
    slug: "numerology",
    title: "Numerology",
    tagline: "The power of your numbers",
    description:
      "Decode your name and birth numbers to understand strengths, lucky numbers, colours and name-correction advice.",
    icon: "Hash",
    priceFrom: 899,
    duration: "30 min",
    status: "active",
    order: 7,
    features: [
      "Name & birth number analysis",
      "Lucky numbers & colours",
      "Name-correction suggestions",
      "Business name consultation",
    ],
  },
  {
    id: "svc_live",
    slug: "live-consultation",
    title: "Live Astrologer Call",
    tagline: "Talk one-on-one, right now",
    description:
      "Connect directly with a senior astrologer over call for instant guidance on any question or life concern.",
    icon: "PhoneCall",
    priceFrom: 499,
    duration: "per 15 min",
    popular: true,
    status: "active",
    order: 8,
    features: [
      "Direct 1-on-1 call",
      "Ask anything, any area",
      "Instant practical remedies",
      "Follow-up summary on WhatsApp",
    ],
  },
];
