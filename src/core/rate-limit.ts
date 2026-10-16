import "server-only";

/**
 * In-memory fixed-window rate limiter.
 *
 * Protects sensitive endpoints (login brute-force, upload spam, public writes).
 * Keyed by whatever the caller passes — typically `${route}:${ip}`. The window
 * resets every `windowSeconds`; up to `limit` requests are allowed per window.
 *
 * Single-instance only (in-memory). For multi-instance deploys swap the store
 * for Redis — the `rateLimit()` signature stays the same. Cached on globalThis
 * to survive hot reloads.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

declare global {
  // eslint-disable-next-line no-var
  var __rateBuckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> = global.__rateBuckets ?? new Map();
global.__rateBuckets = buckets;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Record a hit for `key` and report whether it's within the limit.
 *   const rl = rateLimit(`login:${ip}`, { limit: 5, windowSeconds: 60 });
 *   if (!rl.allowed) → 429
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, opts.limit - bucket.count);
  const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));

  // Opportunistic cleanup so the map doesn't grow forever.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  return {
    allowed: bucket.count <= opts.limit,
    limit: opts.limit,
    remaining,
    retryAfter,
  };
}

/** Best-effort client IP from standard proxy headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
