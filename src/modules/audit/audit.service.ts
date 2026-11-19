/**
 * Audit domain — service. One `record()` helper that every other module calls
 * on a meaningful action, plus `list()` with filters and a cursor for the
 * Activity page. `record()` is defensive: it never throws into the calling
 * flow, but a failed write is logged so a lost record is noticed.
 */
import { ok, type Result } from "@/core/result";
import { newId } from "@/core/id";
import { getAuditRepository, type AuditQuery } from "./audit.repository";
import type { AuditEntry, RecordAuditInput } from "./audit.types";

export const auditService = {
  /** Append an audit entry. Safe to call anywhere. */
  async record(input: RecordAuditInput): Promise<void> {
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
    try {
      await getAuditRepository().add(entry);
    } catch (e) {
      try {
        const { logger } = await import("@/core/logger");
        logger.error("audit write failed", { entity: entry.entity, entityId: entry.entityId, summary: entry.summary.slice(0, 200), error: e instanceof Error ? e.message : String(e) });
      } catch { /* never let auditing break the caller */ }
    }
  },

  /** Newest first. `before` = the `at` of the last entry already shown (load more). */
  async list(filters: AuditQuery = {}): Promise<Result<AuditEntry[]>> {
    return ok(await getAuditRepository().query(filters));
  },
};
