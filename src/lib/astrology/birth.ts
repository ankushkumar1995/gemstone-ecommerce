/**
 * Birth-input parsing shared by the kundli + matching tools.
 *
 * Takes the raw form fields (date string, time string, place/city) and resolves
 * them into the exact UTC instant + coordinates the ephemeris needs, using the
 * built-in city list for coordinates and UTC offset.
 */

import { findCity, type City } from "./cities";

export interface RawBirth {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24h). Defaults to 12:00 if missing.
  place: string; // city name
}

export interface ResolvedBirth {
  utc: Date;
  latitude: number;
  longitude: number;
  city: City;
}

export function resolveBirth(raw: RawBirth): ResolvedBirth | { error: string } {
  const city = findCity(raw.place);
  if (!city) {
    return {
      error:
        "We couldn't find that birth place. Please pick a city from the suggestions.",
    };
  }

  const [y, m, d] = (raw.date || "").split("-").map(Number);
  if (!y || !m || !d) return { error: "Please enter a valid date of birth." };

  const [hh, mm] = (raw.time || "12:00").split(":").map(Number);
  const hour = Number.isFinite(hh) ? hh : 12;
  const min = Number.isFinite(mm) ? mm : 0;

  // Local birth instant → UTC by subtracting the city's UTC offset.
  const localMillis = Date.UTC(y, m - 1, d, hour, min, 0);
  const utc = new Date(localMillis - city.tz * 3600_000);

  return { utc, latitude: city.lat, longitude: city.lon, city };
}
