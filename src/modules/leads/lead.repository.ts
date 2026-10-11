/**
 * Leads domain — repository.
 *
 * The repository is the ONLY place that knows how/where data is stored.
 * Services depend on the `LeadRepository` interface, never on a concrete
 * implementation — so swapping the mock for MongoDB in Phase 2 is a single
 * change in `getLeadRepository()`, with zero changes to services/controllers.
 */

import { env } from "@/core/config/env";
import type { Lead } from "./lead.types";

export interface LeadRepository {
  create(lead: Lead): Promise<Lead>;
  findAll(): Promise<Lead[]>;
  findById(id: string): Promise<Lead | null>;
  updateStatus(id: string, status: Lead["status"]): Promise<Lead | null>;
}

/* ------------------------------------------------------------------ *
 * Mock implementation (in-memory). Pre-seeded with a couple of leads so
 * the admin view has something to show.
 *
 * NOTE: a module-level array resets on server restart / per serverless
 * invocation. That's fine for the mock phase; real persistence arrives
 * with the Mongo implementation.
 * ------------------------------------------------------------------ */
const store: Lead[] = [
  {
    id: "lead_seed_1",
    source: "service",
    name: "Ananya Sharma",
    email: "ananya@example.com",
    phone: "+91 90000 11111",
    topic: "kundli-analysis",
    message: "Looking for a detailed birth-chart reading.",
    birth: { date: "1995-04-12", time: "08:30", place: "Jaipur, India" },
    status: "new",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "lead_seed_2",
    source: "contact",
    name: "Rohan Mehta",
    email: "rohan@example.com",
    topic: "Gemstone Guidance",
    message: "Which stone suits a Capricorn ascendant?",
    status: "contacted",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const mockLeadRepository: LeadRepository = {
  async create(lead) {
    store.unshift(lead);
    return lead;
  },
  async findAll() {
    return [...store];
  },
  async findById(id) {
    return store.find((l) => l.id === id) ?? null;
  },
  async updateStatus(id, status) {
    const lead = store.find((l) => l.id === id);
    if (!lead) return null;
    lead.status = status;
    return lead;
  },
};

/* Mongo implementation placeholder — wired in Phase 2.
 * const mongoLeadRepository: LeadRepository = { ... }
 */

/** Resolve the active repository based on configured data source. */
export function getLeadRepository(): LeadRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      // return mongoLeadRepository; (Phase 2)
      throw new Error("Mongo repository not implemented yet");
    case "mock":
    default:
      return mockLeadRepository;
  }
}
