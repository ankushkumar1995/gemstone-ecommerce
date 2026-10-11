import type { Zodiac } from "@/types";

export const zodiacSigns: Zodiac[] = [
  {
    sign: "aries",
    name: "Aries",
    symbol: "♈",
    dateRange: "Mar 21 – Apr 19",
    element: "Fire",
    rulingPlanet: "Mars",
    luckyStone: "Red Coral",
    accent: "#ff6b6b",
    image:
      "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "taurus",
    name: "Taurus",
    symbol: "♉",
    dateRange: "Apr 20 – May 20",
    element: "Earth",
    rulingPlanet: "Venus",
    luckyStone: "Diamond",
    accent: "#7bd389",
    image:
      "https://images.unsplash.com/photo-1584302179602-e4c3d3fd629d?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "gemini",
    name: "Gemini",
    symbol: "♊",
    dateRange: "May 21 – Jun 20",
    element: "Air",
    rulingPlanet: "Mercury",
    luckyStone: "Emerald",
    accent: "#4ade80",
    image:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "cancer",
    name: "Cancer",
    symbol: "♋",
    dateRange: "Jun 21 – Jul 22",
    element: "Water",
    rulingPlanet: "Moon",
    luckyStone: "Pearl",
    accent: "#a5b4fc",
    image:
      "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "leo",
    name: "Leo",
    symbol: "♌",
    dateRange: "Jul 23 – Aug 22",
    element: "Fire",
    rulingPlanet: "Sun",
    luckyStone: "Ruby",
    accent: "#fbbf24",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "virgo",
    name: "Virgo",
    symbol: "♍",
    dateRange: "Aug 23 – Sep 22",
    element: "Earth",
    rulingPlanet: "Mercury",
    luckyStone: "Emerald",
    accent: "#34d399",
    image:
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "libra",
    name: "Libra",
    symbol: "♎",
    dateRange: "Sep 23 – Oct 22",
    element: "Air",
    rulingPlanet: "Venus",
    luckyStone: "Diamond",
    accent: "#f0abfc",
    image:
      "https://images.unsplash.com/photo-1600267175161-cfaa711b4a81?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "scorpio",
    name: "Scorpio",
    symbol: "♏",
    dateRange: "Oct 23 – Nov 21",
    element: "Water",
    rulingPlanet: "Mars",
    luckyStone: "Red Coral",
    accent: "#f87171",
    image:
      "https://images.unsplash.com/photo-1589674781759-c21c37956a44?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "sagittarius",
    name: "Sagittarius",
    symbol: "♐",
    dateRange: "Nov 22 – Dec 21",
    element: "Fire",
    rulingPlanet: "Jupiter",
    luckyStone: "Yellow Sapphire",
    accent: "#fcd34d",
    image:
      "https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "capricorn",
    name: "Capricorn",
    symbol: "♑",
    dateRange: "Dec 22 – Jan 19",
    element: "Earth",
    rulingPlanet: "Saturn",
    luckyStone: "Blue Sapphire",
    accent: "#60a5fa",
    image:
      "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "aquarius",
    name: "Aquarius",
    symbol: "♒",
    dateRange: "Jan 20 – Feb 18",
    element: "Air",
    rulingPlanet: "Saturn",
    luckyStone: "Blue Sapphire",
    accent: "#38bdf8",
    image:
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=800&q=80",
  },
  {
    sign: "pisces",
    name: "Pisces",
    symbol: "♓",
    dateRange: "Feb 19 – Mar 20",
    element: "Water",
    rulingPlanet: "Jupiter",
    luckyStone: "Yellow Sapphire",
    accent: "#818cf8",
    image:
      "https://images.unsplash.com/photo-1551122089-4e3e72477432?auto=format&fit=crop&w=800&q=80",
  },
];

export function getZodiac(sign: string): Zodiac | undefined {
  return zodiacSigns.find((z) => z.sign === sign);
}
