import "server-only";

/**
 * Lightweight in-memory TTL cache.
 *
 * Used to shave DB round-trips off hot, rarely-changing reads (categories,
 * settings…), which directly improves API response time. The interface is
 * deliberately small so it can be swapped for Redis later with no caller
 * changes: get / set / wrap / del / delByPrefix / clear.
 *
 * Cached on globalThis so it survives Next.js hot reloads in dev. Entries are
 * evicted lazily on read and capped to avoid unbounded growth.
 */

interface Entry {
  value: unknown;
  expiresAt: number; // epoch ms
}

const MAX_ENTRIES = 1000;

declare global {
  // eslint-disable-next-line no-var
  var __appCache: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> = global.__appCache ?? new Map();
global.__appCache = store;

function now() {
  return Date.now();
}

function evictIfExpired(key: string, entry: Entry | undefined): boolean {
  if (!entry) return true;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return true;
  }
  return false;
}

export const cache = {
  /** Get a value, or undefined if missing/expired. */
  get<T>(key: string): T | undefined {
    const entry = store.get(key);
    if (evictIfExpired(key, entry)) return undefined;
    return entry!.value as T;
  },

  /** Set a value with a TTL in seconds. */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (store.size >= MAX_ENTRIES) {
      // Simple guard: drop the oldest inserted key.
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
  },

  /**
   * Return a cached value or compute + cache it. The single entry point most
   * callers use:
   *   const cats = await cache.wrap("categories:all", 60, () => repo.findAll());
   */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    this.set(key, value, ttlSeconds);
    return value;
  },

  /** Delete one key. */
  del(key: string): void {
    store.delete(key);
  },

  /** Delete every key starting with `prefix` (e.g. "categories:"). */
  delByPrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /** Clear everything (tests / admin). */
  clear(): void {
    store.clear();
  },

  /** Rough stats for a health/debug view. */
  stats() {
    return { size: store.size, maxEntries: MAX_ENTRIES };
  },
};
