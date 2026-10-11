/**
 * Audit domain — service. One `record()` helper that every other module calls
 * on a meaningful action, plus `list()` with light filters for the Activity
 * page. `record()` is defensive — it never throws into the calling flow.
 */

import { ok, type Result } from "@/core/result";
import { newId } from "@/core/id";
import { getAuditRepository } from "./audit.repository";
import type { AuditAction, AuditEntity, AuditEntry, RecordAuditInput } from "./audit.types";

export const auditService = {
  /**
   * Append an audit entry. Safe to call anywhere — swallows its own errors so
   * a logging failure can never break the primary operation.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      const repo = getAuditRepository();
      const entry: AuditEntry = {
        id: newId("aud"),
        at: new Date().toISOString(),
        actor: input.actor ?? "Admin",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        entityLabel: input.entityLabel,
        summary: input.summary,
      };
      await repo.add(entry);
    } catch {
      /* never let auditing break the caller */
    }
  },

  async list(filters?: {
    entity?: AuditEntity;
    action?: AuditAction;
    q?: string;
  }): Promise<Result<AuditEntry[]>> {
    const repo = getAuditRepository();
    let entries = await repo.findAll();
    if (filters?.entity) entries = entries.filter((e) => e.entity === filters.entity);
    if (filters?.action) entries = entries.filter((e) => e.action === filters.action);
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          (e.entityLabel ?? "").toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q)
      );
    }
    return ok(entries);
  },
};
