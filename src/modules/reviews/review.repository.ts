/**
 * Reviews domain — repository. Mock in-memory store seeded with a mix of
 * approved + pending reviews. Swap for Mongo later via getReviewRepository().
 */

import { env } from "@/core/config/env";
import type { Review } from "./review.types";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export interface ReviewRepository {
  findAll(): Promise<Review[]>;
  findById(id: string): Promise<Review | null>;
  findByProduct(productId: string): Promise<Review[]>;
  create(review: Review): Promise<Review>;
  update(id: string, patch: Partial<Review>): Promise<Review | null>;
  remove(id: string): Promise<boolean>;
}

const store: Review[] = [
  {
    id: "rev_1",
    productId: "p1",
    productName: "Royal Ruby Signet Ring",
    productImage: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    authorName: "Ananya Sharma",
    authorEmail: "ananya@example.com",
    rating: 5,
    title: "Exactly as described",
    body: "The stone came with full certification and the colour is even better in person. Packaging was premium.",
    verified: true,
    status: "approved",
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  },
  {
    id: "rev_2",
    productId: "p1",
    productName: "Royal Ruby Signet Ring",
    productImage: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
    authorName: "Rohan Mehta",
    rating: 4,
    title: "Beautiful & certified",
    body: "Authentic and well-packed. Took a little long to ship but worth the wait.",
    verified: true,
    status: "approved",
    reply: "Thank you Rohan! Glad you loved it. 💛",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(18),
  },
  {
    id: "rev_3",
    productId: "p2",
    productName: "Celestial Blue Sapphire Ring",
    productImage: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=900&q=80",
    authorName: "Priya Nair",
    authorEmail: "priya@example.com",
    rating: 5,
    title: "Felt the difference",
    body: "Consulted their astrologer before buying. Genuine guidance and a clean, natural stone.",
    verified: false,
    status: "pending",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "rev_4",
    productId: "p3",
    productName: "Emerald Vine Pendant",
    authorName: "Anonymous",
    rating: 2,
    body: "Spam-looking review with a suspicious link.",
    verified: false,
    status: "pending",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

const mockReviewRepository: ReviewRepository = {
  async findAll() {
    return store.map((r) => ({ ...r }));
  },
  async findById(id) {
    const r = store.find((x) => x.id === id);
    return r ? { ...r } : null;
  },
  async findByProduct(productId) {
    return store.filter((x) => x.productId === productId).map((r) => ({ ...r }));
  },
  async create(review) {
    store.unshift(review);
    return { ...review };
  },
  async update(id, patch) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...patch };
    return { ...store[idx] };
  },
  async remove(id) {
    const idx = store.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  },
};

export function getReviewRepository(): ReviewRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo review repository not implemented yet");
    case "mock":
    default:
      return mockReviewRepository;
  }
}
