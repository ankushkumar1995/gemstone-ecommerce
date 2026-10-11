/**
 * Customers domain — repository. Mock in-memory store, pre-seeded so the admin
 * customers view has data. Swap for Mongo later via getCustomerRepository().
 */

import { env } from "@/core/config/env";
import type { Customer } from "./customer.types";

export interface CustomerRepository {
  findAll(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  create(customer: Customer): Promise<Customer>;
  update(id: string, patch: Partial<Customer>): Promise<Customer | null>;
  remove(id: string): Promise<boolean>;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const store: Customer[] = [
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

const mockCustomerRepository: CustomerRepository = {
  async findAll() {
    return store.map((c) => ({ ...c }));
  },
  async findById(id) {
    const c = store.find((x) => x.id === id);
    return c ? { ...c } : null;
  },
  async findByEmail(email) {
    const c = store.find((x) => x.email.toLowerCase() === email.toLowerCase());
    return c ? { ...c } : null;
  },
  async create(customer) {
    store.unshift(customer);
    return { ...customer };
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

export function getCustomerRepository(): CustomerRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo customer repository not implemented yet");
    case "mock":
    default:
      return mockCustomerRepository;
  }
}
