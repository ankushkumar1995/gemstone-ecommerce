/**
 * Leads domain — service (business logic).
 *
 * The service owns the rules: it assembles a complete Lead from validated
 * input, applies defaults, and talks to the repository. It returns Result<T>
 * so callers handle success/failure explicitly. It never touches HTTP.
 *
 * Side effects like "send an email / notify sales" belong here too (added in
 * a later phase) — a clean, single place to extend.
 */

import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { newId } from "@/core/id";
import { getLeadRepository } from "./lead.repository";
import type { CreateLeadInput, Lead, LeadStatus } from "./lead.types";

export const leadService = {
  async create(input: CreateLeadInput): Promise<Result<Lead>> {
    const repo = getLeadRepository();

    const lead: Lead = {
      id: newId("lead"),
      source: input.source,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      topic: input.topic?.trim() || undefined,
      message: input.message?.trim() || undefined,
      birth: input.birth,
      status: "new",
      createdAt: new Date().toISOString(),
    };

    const created = await repo.create(lead);

    // Phase 2 hook: notify sales / send confirmation email here.
    // await notifyNewLead(created);

    return ok(created);
  },

  async list(): Promise<Result<Lead[]>> {
    const repo = getLeadRepository();
    const leads = await repo.findAll();
    // newest first
    leads.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(leads);
  },

  async setStatus(id: string, status: LeadStatus): Promise<Result<Lead>> {
    const repo = getLeadRepository();
    const updated = await repo.updateStatus(id, status);
    if (!updated) return fail(AppErrors.notFound("Lead not found"));
    return ok(updated);
  },
};
