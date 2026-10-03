export interface WebSearchConfig {
  searxngUrl: string | null;
  enabled: boolean;
  fetchTimeoutMs: number;
  maxBytes: number;
  maxResults: number;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_RESULTS = 5;

function intEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadWebSearchConfig(
  env: Record<string, string | undefined>,
): WebSearchConfig {
  const rawUrl = (env.WEBSEARCH_SEARXNG_URL ?? "").trim();
  const searxngUrl = rawUrl.length > 0 ? rawUrl.replace(/\/+$/, "") : null;

  return {
    searxngUrl,
    enabled: searxngUrl !== null,
    fetchTimeoutMs: intEnv(env.WEBSEARCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxBytes: intEnv(env.WEBSEARCH_MAX_BYTES, DEFAULT_MAX_BYTES),
    maxResults: intEnv(env.WEBSEARCH_MAX_RESULTS, DEFAULT_MAX_RESULTS),
  };
}
