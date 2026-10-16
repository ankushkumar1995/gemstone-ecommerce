import type { Customer } from "@/modules/customers/customer.types";

/**
 * Mock customer seed. Also the single source the seed script loads into Mongo
 * (via scripts/seed-mongo.ts) so the mock and real DB start identical.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const customers: Customer[] = [
  {
    id: "cus_seed_1",
    name: "Ananya Sharma",
    email: "ananya@example.com",
    phone: "+91 90000 11111",
    status: "vip",
    tags: ["repeat", "ruby-lover"],
    notes: "Prefers natural Burmese rubies. Follow up on anniversary.",
    addresses: [
      {
        id: "adr_1",
        label: "Home",
        line1: "12 Residency Road",
        city: "Jaipur",
        state: "Rajasthan",
        postalCode: "302001",
        country: "India",
        isDefault: true,
      },
    ],
    totalOrders: 7,
    totalSpent: 318500,
    lastOrderAt: daysAgo(6),
    activity: [
      { id: "a1", at: daysAgo(6), type: "order", message: "Placed order #NK-2026-1042", actor: "System" },
      { id: "a2", at: daysAgo(40), type: "status", message: "Upgraded to VIP", actor: "Admin" },
      { id: "a3", at: daysAgo(210), type: "created", message: "Account created", actor: "System" },
    ],
    createdAt: daysAgo(210),
  },
  {
    id: "cus_seed_2",
    name: "Rohan Mehta",
    email: "rohan@example.com",
    phone: "+91 98888 22222",
    status: "active",
    tags: ["capricorn"],
    addresses: [
      {
        id: "adr_2",
        label: "Office",
        line1: "4th Floor, Nirmal Tower",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400021",
        country: "India",
        isDefault: true,
      },
    ],
    totalOrders: 2,
    totalSpent: 54980,
    lastOrderAt: daysAgo(22),
    activity: [
      { id: "b1", at: daysAgo(22), type: "order", message: "Placed order #NK-2026-0988", actor: "System" },
      { id: "b2", at: daysAgo(95), type: "created", message: "Account created", actor: "System" },
    ],
    createdAt: daysAgo(95),
  },
  {
    id: "cus_seed_3",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    phone: "+91 97777 33333",
    status: "active",
    tags: ["newsletter"],
    addresses: [],
    totalOrders: 1,
    totalSpent: 18999,
    lastOrderAt: daysAgo(70),
    activity: [
      { id: "c1", at: daysAgo(70), type: "order", message: "Placed first order", actor: "System" },
      { id: "c2", at: daysAgo(72), type: "created", message: "Account created", actor: "System" },
    ],
    createdAt: daysAgo(72),
  },
  {
    id: "cus_seed_4",
    name: "Vikram Singh",
    email: "vikram.s@example.com",
    status: "blocked",
    tags: ["chargeback"],
    notes: "Blocked after payment dispute.",
    addresses: [],
    totalOrders: 0,
    totalSpent: 0,
    activity: [
      { id: "d1", at: daysAgo(30), type: "status", message: "Account blocked", actor: "Admin" },
      { id: "d2", at: daysAgo(120), type: "created", message: "Account created", actor: "System" },
    ],
    createdAt: daysAgo(120),
  },
];
