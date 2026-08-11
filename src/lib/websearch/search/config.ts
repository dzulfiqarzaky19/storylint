// M1 — web-search engine configuration.
//
// PORTABLE MODULE BOUNDARY: this file (and everything under src/lib/websearch/)
// imports ONLY node builtins, undici, linkedom, defuddle, and its own siblings.
// It MUST NOT import @/lib/domain, @/lib/db, @/lib/research/*, @/lib/ai/*, or
// any storylint type. The engine defines its own types.
//
// Config is derived from a plain env record (not process.env directly) so it is
// pure and testable with no global mutation. The stream route passes
// `process.env` at call time.

/** Fully-resolved engine configuration. All fields are non-optional. */
export interface WebSearchConfig {
  /** SearXNG JSON base URL, or null when unconfigured (search disabled). */
  searxngUrl: string | null;
  /** True only when a real SearXNG base URL is present. */
  enabled: boolean;
  /** Per-request fetch timeout in ms (safeFetch + provider requests). */
  fetchTimeoutMs: number;
  /** Hard byte cap on any fetched body (OOM safety). */
  maxBytes: number;
  /** Max search results to consider / read. */
  maxResults: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // ~5MB
const DEFAULT_MAX_RESULTS = 5;

/** Parse a positive integer from an env string, or fall back on garbage/absent. */
function intEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Derive the engine config from an env record.
 *
 * The null guard on `searxngUrl` is the load-bearing line: an unset or
 * whitespace-only URL yields `searxngUrl: null` and `enabled: false`, which is
 * what makes the whole feature fail-soft (no URL => no live search, floor only).
 */
export function loadWebSearchConfig(
  env: Record<string, string | undefined>,
): WebSearchConfig {
  const rawUrl = (env.WEBSEARCH_SEARXNG_URL ?? "").trim();
  // NULL GUARD (mutation target): empty after trim => null => disabled.
  const searxngUrl = rawUrl.length > 0 ? rawUrl.replace(/\/+$/, "") : null;

  return {
    searxngUrl,
    enabled: searxngUrl !== null,
    fetchTimeoutMs: intEnv(env.WEBSEARCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxBytes: intEnv(env.WEBSEARCH_MAX_BYTES, DEFAULT_MAX_BYTES),
    maxResults: intEnv(env.WEBSEARCH_MAX_RESULTS, DEFAULT_MAX_RESULTS),
  };
}
