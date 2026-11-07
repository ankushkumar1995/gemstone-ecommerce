/**
 * Tiny in-process event hooks so other modules can react to astrologer
 * changes without circular imports (e.g. the consultations module ends a live
 * session when its astrologer is suspended). Listeners must never throw into
 * the caller; failures are swallowed and logged.
 */

import { logger } from "@/core/logger";

type BlockedListener = (astrologerId: string, reason: string) => Promise<void> | void;

declare global {
  var __astroBlockedListeners: BlockedListener[] | undefined;
}
const blocked: BlockedListener[] = global.__astroBlockedListeners ?? [];
global.__astroBlockedListeners = blocked;

/** Subscribe once (idempotent per function reference). */
export function onAstrologerBlocked(fn: BlockedListener): void {
  if (!blocked.includes(fn)) blocked.push(fn);
}

/** Fired when an astrologer is suspended, deactivated, removed or forced offline. */
export async function emitAstrologerBlocked(astrologerId: string, reason: string): Promise<void> {
  for (const fn of blocked) {
    try {
      await fn(astrologerId, reason);
    } catch (e) {
      logger.error("astrologer blocked listener failed", { astrologerId, error: e instanceof Error ? e.message : String(e) });
    }
  }
}
