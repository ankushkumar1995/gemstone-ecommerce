/**
 * Leads domain — repository.
 *
 * The repository is the ONLY place that knows how/where data is stored.
 * Services depend on the `LeadRepository` interface, never on a concrete
 * implementation — so swapping the mock for MongoDB in Phase 2 is a single
 * change in `getLeadRepository()`, with zero changes to services/controllers.
 */

import { dataSourceFor } from "@/core/config/env";
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
 * NOTE: a module-level array resets on server restart. Only used when no
 * database is configured; with MONGODB_URI set, leads go to Mongo below.
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

/* ------------------------------------------------------------------ *
 * Mongo implementation (production). The database assigns the id
 * (ObjectId); the mock-style id the service generates is ignored.
 * ------------------------------------------------------------------ */

/** Newest leads returned to the admin list (keeps the payload bounded). */
const LIST_LIMIT = 1000;

type Row = {
  _id: unknown;
  source: Lead["source"];
  name: string;
  email: string;
  phone?: string | null;
  topic?: string | null;
  message?: string | null;
  birth?: { date?: string | null; time?: string | null; place?: string | null } | null;
  gender?: Lead["gender"] | null;
  maritalStatus?: Lead["maritalStatus"] | null;
  astrologer?: string | null;
  status: Lead["status"];
  createdAt?: Date;
};

const isOid = (id: string) => /^[a-f0-9]{24}$/i.test(id);

async function M() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return (await import("./lead.model")).LeadModel;
}

/** Drop null/empty values so the API shape matches the mock exactly. */
const opt = <T,>(v: T | null | undefined): T | undefined =>
  v === null || v === undefined || (v as unknown) === "" ? undefined : v;

function out(d: Row): Lead {
  const birth = d.birth
    ? {
        ...(opt(d.birth.date) && { date: d.birth.date as string }),
        ...(opt(d.birth.time) && { time: d.birth.time as string }),
        ...(opt(d.birth.place) && { place: d.birth.place as string }),
      }
    : undefined;
  return {
    id: String(d._id),
    source: d.source,
    name: d.name,
    email: d.email,
    phone: opt(d.phone),
    topic: opt(d.topic),
    message: opt(d.message),
    birth: birth && Object.keys(birth).length ? birth : undefined,
    gender: opt(d.gender),
    maritalStatus: opt(d.maritalStatus),
    astrologer: opt(d.astrologer),
    status: d.status,
    createdAt: (d.createdAt instanceof Date ? d.createdAt : new Date()).toISOString(),
  };
}

const mongoLeadRepository: LeadRepository = {
  async create(lead) {
    const m = await M();
    const { id: _id, createdAt: _c, ...data } = lead;
    void _id;
    void _c;
    const doc = await m.create(data);
    return out(doc.toObject() as unknown as Row);
  },
  async findAll() {
    const m = await M();
    const rows = await m.find().sort({ createdAt: -1 }).limit(LIST_LIMIT).lean<Row[]>();
    return rows.map(out);
  },
  async findById(id) {
    if (!isOid(id)) return null;
    const m = await M();
    const d = await m.findById(id).lean<Row>();
    return d ? out(d) : null;
  },
  async updateStatus(id, status) {
    if (!isOid(id)) return null;
    const m = await M();
    const d = await m
      .findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after", runValidators: true })
      .lean<Row>();
    return d ? out(d) : null;
  },
};

/** Mongo when a database is configured (see dataSourceFor), else the mock. */
export function getLeadRepository(): LeadRepository {
  return dataSourceFor("leads") === "mongo" ? mongoLeadRepository : mockLeadRepository;
}
