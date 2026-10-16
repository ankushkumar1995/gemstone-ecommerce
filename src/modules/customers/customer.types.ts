/**
 * Customers domain — types. Single source of truth for a Customer record.
 *
 * A customer is someone with an account / order history (distinct from a
 * "lead", who is only an enquiry). Lifetime stats (totalOrders, totalSpent,
 * lastOrderAt) are mock-seeded for now; once the orders module exists they
 * will be derived from real orders.
 */

export type CustomerStatus = "active" | "vip" | "blocked";

export interface CustomerAddress {
  id: string;
  label: string; // e.g. "Home", "Office"
  name?: string; // recipient name
  phone?: string; // recipient phone
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault?: boolean;
}

export interface CustomerActivity {
  id: string;
  at: string; // ISO
  type: "created" | "updated" | "note" | "status" | "order";
  message: string;
  actor?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: CustomerStatus;
  tags: string[];
  notes?: string;
  addresses: CustomerAddress[];
  /** Product ids the customer has wishlisted (storefront self-service). */
  wishlist?: string[];

  /* lifetime stats (mock for now, derived from orders later) */
  totalOrders: number;
  totalSpent: number; // in rupees
  lastOrderAt?: string; // ISO

  activity: CustomerActivity[];
  createdAt: string; // ISO
}

/** Fields accepted when creating a customer (server fills the rest). */
export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status?: CustomerStatus;
  tags?: string[];
  notes?: string;
  addresses?: Omit<CustomerAddress, "id">[];
}

/** Fields accepted when updating a customer. */
export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  status?: CustomerStatus;
  tags?: string[];
  notes?: string;
  addresses?: Omit<CustomerAddress, "id">[];
}
