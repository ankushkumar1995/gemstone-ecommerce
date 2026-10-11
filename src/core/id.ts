/**
 * Small ID helpers. Kept in one place so swapping to a DB-native id
 * (ObjectId / uuid / cuid) later is a single change.
 */

/** A reasonably-unique id for mock records. */
export function newId(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Human-friendly sequential-ish reference, e.g. NK-2026-4821. */
export function newReference(prefix = "NK"): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${n}`;
}
