/**
 * Audit domain — repository. Mock in-memory ring buffer (newest first,
 * capped) so the log never grows unbounded in the mock phase. Swap for Mongo
 * (an append-only collection) later via getAuditRepository().
 */

import { env } from "@/core/config/env";
import type { AuditEntry } from "./audit.types";

const MAX_ENTRIES = 500;

export interface AuditRepository {
  add(entry: AuditEntry): Promise<void>;
  findAll(): Promise<AuditEntry[]>;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// a little seed history so the page isn't empty on first load
const store: AuditEntry[] = [
  { id: "aud_s1", at: daysAgo(0), actor: "Admin", action: "status", entity: "order", entityId: "ord_seed_1", entityLabel: "NK-2026-1042", summary: "Order NK-2026-1042 marked shipped" },
  { id: "aud_s2", at: daysAgo(1), actor: "Admin", action: "create", entity: "coupon", entityLabel: "FLAT500", summary: "Created coupon FLAT500" },
  { id: "aud_s3", at: daysAgo(2), actor: "Admin", action: "update", entity: "product", entityId: "p2", entityLabel: "Celestial Blue Sapphire Ring", summary: "Updated product details" },
];

const mockAuditRepository: AuditRepository = {
  async add(entry) {
    store.unshift(entry);
    if (store.length > MAX_ENTRIES) store.length = MAX_ENTRIES;
  },
  async findAll() {
    return store.map((e) => ({ ...e }));
  },
};

export function getAuditRepository(): AuditRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo audit repository not implemented yet");
    case "mock":
    default:
      return mockAuditRepository;
  }
}
