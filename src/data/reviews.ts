import type { Product } from "@/types";

export interface Review {
  id: string;
  name: string;
  initials: string;
  rating: number;
  date: string;
  verified: boolean;
  title: string;
  body: string;
}

const NAMES = [
  "Ananya Sharma",
  "Rohan Mehta",
  "Priya Nair",
  "Vikram Desai",
  "Sneha Kapoor",
  "Arjun Reddy",
  "Kavya Iyer",
  "Manish Gupta",
];

const TITLES = [
  "Exactly as described",
  "Beautiful & certified",
  "Felt the difference",
  "Premium quality stone",
  "Highly recommend",
  "Worth every rupee",
];

const BODIES = [
  "The stone came with full certification and the colour is even better in person. Packaging was premium and delivery was quick.",
  "I consulted their astrologer before buying and the guidance was genuine. The gemstone is clean and natural — very happy.",
  "Beautifully cut and energised before dispatch. Within a few weeks I noticed a positive shift. Will buy again.",
  "Authentic, well-packed and exactly the carat weight promised. The certificate was verifiable online.",
  "Customer service was patient and helped me choose the right stone for my chart. Great experience overall.",
];

/** Simple deterministic hash so reviews are stable per product (SSG-safe). */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Generate a stable set of reviews for a product. */
export function getReviews(product: Product): Review[] {
  const seed = hash(product.id);
  const count = 3 + (seed % 3); // 3–5 reviews
  const dates = ["2 weeks ago", "1 month ago", "3 weeks ago", "2 months ago", "5 days ago"];

  return Array.from({ length: count }).map((_, i) => {
    const s = hash(product.id + i);
    const name = NAMES[(seed + i) % NAMES.length];
    // ratings cluster around the product rating (4 or 5 stars)
    const rating = (s % 5) === 0 ? 4 : 5;
    return {
      id: `${product.id}-r${i}`,
      name,
      initials: initialsOf(name),
      rating,
      date: dates[(s + i) % dates.length],
      verified: s % 4 !== 0,
      title: TITLES[(s + i) % TITLES.length],
      body: BODIES[(s + i) % BODIES.length],
    };
  });
}

/** Rating distribution (5★ → 1★ counts) for the summary bars. */
export function getRatingBreakdown(product: Product): number[] {
  const total = product.reviews;
  // weight most reviews to 5 and 4 stars
  const five = Math.round(total * 0.72);
  const four = Math.round(total * 0.2);
  const three = Math.round(total * 0.05);
  const two = Math.round(total * 0.02);
  const one = Math.max(0, total - five - four - three - two);
  return [five, four, three, two, one];
}
