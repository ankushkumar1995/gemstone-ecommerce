/**
 * Returns (RMA) domain — repository. Mock in-memory store. Swap for Mongo
 * later via getReturnRepository().
 */

import { env } from "@/core/config/env";
import type { ReturnRequest } from "./return.types";

export interface ReturnRepository {
  findAll(): Promise<ReturnRequest[]>;
  findById(id: string): Promise<ReturnRequest | null>;
  findByOrder(orderId: string): Promise<ReturnRequest[]>;
  create(ret: ReturnRequest): Promise<ReturnRequest>;
  update(id: string, patch: Partial<ReturnRequest>): Promise<ReturnRequest | null>;
  remove(id: string): Promise<boolean>;
}

const store: ReturnRequest[] = [
  {
    id: "ret_seed_1",
    returnNumber: "RMA-2026-0007",
    orderId: "ord_seed_1",
    orderNumber: "NK-2026-1042",
    customer: { name: "Ananya Sharma", email: "ananya@example.com", phone: "+91 90000 11111" },
    customerId: "cus_seed_1",
    items: [
      {
        productId: "p1",
        name: "Royal Ruby Signet Ring",
        image:
          "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80",
        qty: 1,
        unitPrice: 42999,
        lineRefund: 42999,
      },
    ],
    reason: "not_as_described",
    comment: "Colour looks lighter than the photos.",
    status: "requested",
    suggestedRefund: 42999,
    restock: true,
    activity: [
      { id: "ra1", at: new Date(Date.now() - 86400000).toISOString(), type: "created", message: "Return requested", actor: "Customer" },
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockReturnRepository: ReturnRepository = {
  async findAll() {
    return store.map((r) => ({ ...r }));
  },
  async findById(id) {
    const r = store.find((x) => x.id === id);
    return r ? { ...r } : null;
  },
  async findByOrder(orderId) {
    return store.filter((x) => x.orderId === orderId).map((r) => ({ ...r }));
  },
  async create(ret) {
    store.unshift(ret);
    return { ...ret };
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

export function getReturnRepository(): ReturnRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo return repository not implemented yet");
    case "mock":
    default:
      return mockReturnRepository;
  }
}
