/**
 * Birth-place lookup — a compact built-in list of common Indian + world cities
 * with coordinates and UTC offset (hours). Used so the kundli tools work fully
 * offline with no external geocoding API.
 *
 * `tz` is the standard UTC offset in hours (e.g. India = +5.5). This is enough
 * to convert local birth time to the UTC instant the ephemeris needs.
 */

export interface City {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
  tz: number; // UTC offset in hours
}

export const CITIES: City[] = [
  // --- India (major) ---
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.209, tz: 5.5 },
  { name: "New Delhi", country: "India", lat: 28.6139, lon: 77.209, tz: 5.5 },
  { name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777, tz: 5.5 },
  { name: "Kolkata", country: "India", lat: 22.5726, lon: 88.3639, tz: 5.5 },
  { name: "Chennai", country: "India", lat: 13.0827, lon: 80.2707, tz: 5.5 },
  { name: "Bengaluru", state: "Karnataka", country: "India", lat: 12.9716, lon: 77.5946, tz: 5.5 },
  { name: "Bangalore", state: "Karnataka", country: "India", lat: 12.9716, lon: 77.5946, tz: 5.5 },
  { name: "Hyderabad", country: "India", lat: 17.385, lon: 78.4867, tz: 5.5 },
  { name: "Pune", country: "India", lat: 18.5204, lon: 73.8567, tz: 5.5 },
  { name: "Ahmedabad", country: "India", lat: 23.0225, lon: 72.5714, tz: 5.5 },
  { name: "Jaipur", country: "India", lat: 26.9124, lon: 75.7873, tz: 5.5 },
  { name: "Lucknow", country: "India", lat: 26.8467, lon: 80.9462, tz: 5.5 },
  { name: "Kanpur", country: "India", lat: 26.4499, lon: 80.3319, tz: 5.5 },
  { name: "Nagpur", country: "India", lat: 21.1458, lon: 79.0882, tz: 5.5 },
  { name: "Indore", country: "India", lat: 22.7196, lon: 75.8577, tz: 5.5 },
  { name: "Bhopal", country: "India", lat: 23.2599, lon: 77.4126, tz: 5.5 },
  { name: "Patna", country: "India", lat: 25.5941, lon: 85.1376, tz: 5.5 },
  { name: "Surat", country: "India", lat: 21.1702, lon: 72.8311, tz: 5.5 },
  { name: "Vadodara", country: "India", lat: 22.3072, lon: 73.1812, tz: 5.5 },
  { name: "Chandigarh", country: "India", lat: 30.7333, lon: 76.7794, tz: 5.5 },
  { name: "Noida", country: "India", lat: 28.5355, lon: 77.391, tz: 5.5 },
  { name: "Gurugram", country: "India", lat: 28.4595, lon: 77.0266, tz: 5.5 },
  { name: "Ludhiana", country: "India", lat: 30.901, lon: 75.8573, tz: 5.5 },
  { name: "Agra", country: "India", lat: 27.1767, lon: 78.0081, tz: 5.5 },
  { name: "Varanasi", country: "India", lat: 25.3176, lon: 82.9739, tz: 5.5 },
  { name: "Prayagraj", country: "India", lat: 25.4358, lon: 81.8463, tz: 5.5 },
  { name: "Ranchi", country: "India", lat: 23.3441, lon: 85.3096, tz: 5.5 },
  { name: "Guwahati", country: "India", lat: 26.1445, lon: 91.7362, tz: 5.5 },
  { name: "Bhubaneswar", country: "India", lat: 20.2961, lon: 85.8245, tz: 5.5 },
  { name: "Coimbatore", country: "India", lat: 11.0168, lon: 76.9558, tz: 5.5 },
  { name: "Kochi", country: "India", lat: 9.9312, lon: 76.2673, tz: 5.5 },
  { name: "Thiruvananthapuram", country: "India", lat: 8.5241, lon: 76.9366, tz: 5.5 },
  { name: "Jodhpur", country: "India", lat: 26.2389, lon: 73.0243, tz: 5.5 },
  { name: "Udaipur", country: "India", lat: 24.5854, lon: 73.7125, tz: 5.5 },
  { name: "Amritsar", country: "India", lat: 31.634, lon: 74.8723, tz: 5.5 },
  { name: "Dehradun", country: "India", lat: 30.3165, lon: 78.0322, tz: 5.5 },
  { name: "Raipur", country: "India", lat: 21.2514, lon: 81.6296, tz: 5.5 },
  { name: "Jabalpur", country: "India", lat: 23.1815, lon: 79.9864, tz: 5.5 },
  { name: "Gwalior", country: "India", lat: 26.2183, lon: 78.1828, tz: 5.5 },
  { name: "Meerut", country: "India", lat: 28.9845, lon: 77.7064, tz: 5.5 },
  { name: "Nashik", country: "India", lat: 19.9975, lon: 73.7898, tz: 5.5 },
  { name: "Aurangabad", country: "India", lat: 19.8762, lon: 75.3433, tz: 5.5 },
  { name: "Siliguri", country: "India", lat: 26.7271, lon: 88.3953, tz: 5.5 },
  { name: "Jammu", country: "India", lat: 32.7266, lon: 74.857, tz: 5.5 },
  { name: "Srinagar", country: "India", lat: 34.0837, lon: 74.7973, tz: 5.5 },
  { name: "Shimla", country: "India", lat: 31.1048, lon: 77.1734, tz: 5.5 },

  // --- World (NRI hubs) ---
  { name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, tz: 4 },
  { name: "Abu Dhabi", country: "UAE", lat: 24.4539, lon: 54.3773, tz: 4 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, tz: 8 },
  { name: "London", country: "UK", lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.006, tz: -5 },
  { name: "Chicago", country: "USA", lat: 41.8781, lon: -87.6298, tz: -6 },
  { name: "San Francisco", country: "USA", lat: 37.7749, lon: -122.4194, tz: -8 },
  { name: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437, tz: -8 },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, tz: -5 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, tz: 10 },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631, tz: 10 },
  { name: "Kathmandu", country: "Nepal", lat: 27.7172, lon: 85.324, tz: 5.75 },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lon: 79.8612, tz: 5.5 },
];

/** Case-insensitive search by city name (partial match), capped. */
export function searchCities(query: string, limit = 8): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, limit);
}

/** Exact-ish lookup for a typed place; falls back to a partial match. */
export function findCity(name: string): City | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return (
    CITIES.find((c) => c.name.toLowerCase() === q) ??
    CITIES.find((c) => c.name.toLowerCase().includes(q))
  );
}
