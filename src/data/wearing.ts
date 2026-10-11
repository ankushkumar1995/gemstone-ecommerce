import type { Planet } from "@/types";

/**
 * Traditional "how to wear" guidance per ruling planet. Used on the product
 * detail page so each gemstone shows its own ritual (day, finger, metal,
 * mantra). Values follow common Vedic astrology conventions.
 */
export interface WearingGuide {
  day: string;
  finger: string;
  metal: string;
  mantra: string;
  time: string;
}

const guides: Record<Planet, WearingGuide> = {
  Sun: {
    day: "Sunday",
    finger: "Ring finger",
    metal: "Gold / Panchdhatu",
    mantra: "Om Hraam Hreem Hraum Sah Suryaya Namah",
    time: "Sunrise",
  },
  Moon: {
    day: "Monday",
    finger: "Little finger",
    metal: "Silver",
    mantra: "Om Shraam Shreem Shraum Sah Chandraya Namah",
    time: "Evening",
  },
  Mars: {
    day: "Tuesday",
    finger: "Ring finger",
    metal: "Gold / Copper",
    mantra: "Om Kraam Kreem Kraum Sah Bhaumaya Namah",
    time: "Sunrise",
  },
  Mercury: {
    day: "Wednesday",
    finger: "Little finger",
    metal: "Gold",
    mantra: "Om Braam Breem Braum Sah Budhaya Namah",
    time: "Morning",
  },
  Jupiter: {
    day: "Thursday",
    finger: "Index finger",
    metal: "Gold",
    mantra: "Om Graam Greem Graum Sah Gurave Namah",
    time: "Sunrise",
  },
  Venus: {
    day: "Friday",
    finger: "Middle / Ring finger",
    metal: "Silver / Platinum",
    mantra: "Om Draam Dreem Draum Sah Shukraya Namah",
    time: "Sunrise",
  },
  Saturn: {
    day: "Saturday",
    finger: "Middle finger",
    metal: "Silver / Panchdhatu",
    mantra: "Om Praam Preem Praum Sah Shanaye Namah",
    time: "Evening (before sunset)",
  },
  Rahu: {
    day: "Saturday",
    finger: "Middle finger",
    metal: "Silver / Panchdhatu",
    mantra: "Om Bhraam Bhreem Bhraum Sah Rahave Namah",
    time: "Evening",
  },
  Ketu: {
    day: "Thursday",
    finger: "Ring finger",
    metal: "Silver / Panchdhatu",
    mantra: "Om Sraam Sreem Sraum Sah Ketave Namah",
    time: "Evening",
  },
};

export function getWearingGuide(planet: Planet): WearingGuide {
  return guides[planet];
}
