/**
 * Reviews domain — types. Customer product reviews that admins moderate.
 * Approved reviews drive a product's visible rating & review count.
 *
 * Lifecycle: pending → approved | rejected
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  authorName: string;
  authorEmail?: string;
  rating: number; // 1–5
  title?: string;
  body: string;
  verified: boolean; // verified purchase
  status: ReviewStatus;
  reply?: string; // admin / store reply
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewInput {
  productId: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  body: string;
}
