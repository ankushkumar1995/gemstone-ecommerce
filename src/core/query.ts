/**
 * Query + pagination helpers for list endpoints.
 *
 * Parses `?page`, `?limit`, `?sort`, `?q` from a URL into a safe, typed shape
 * (clamped so a client can't request a million rows or a negative page), and
 * provides a consistent paginated response envelope used by every list API.
 *
 * Sort syntax: `sort=order` (asc) or `sort=-createdAt` (desc). Multiple keys
 * comma-separated: `sort=-createdAt,title`.
 */

export interface ListParams {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
  q: string | undefined;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Parse list params from a URL's search params, with safe clamping. */
export function parseListParams(
  searchParams: URLSearchParams,
  opts?: { defaultSort?: Record<string, 1 | -1>; allowedSortKeys?: string[] },
): ListParams {
  const page = clampInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER, 1);
  const limit = clampInt(searchParams.get("limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);

  const sort = parseSort(searchParams.get("sort"), opts?.allowedSortKeys) ?? opts?.defaultSort ?? {};
  const qRaw = searchParams.get("q")?.trim();
  const q = qRaw && qRaw.length > 0 ? qRaw.slice(0, 120) : undefined;

  return { page, limit, skip: (page - 1) * limit, sort, q };
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseSort(
  raw: string | null,
  allowed?: string[],
): Record<string, 1 | -1> | undefined {
  if (!raw) return undefined;
  const out: Record<string, 1 | -1> = {};
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const desc = token.startsWith("-");
    const key = desc ? token.slice(1) : token;
    if (allowed && !allowed.includes(key)) continue; // ignore unknown keys
    out[key] = desc ? -1 : 1;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Build the standard paginated envelope. */
export function paginate<T>(items: T[], total: number, params: ListParams): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}
