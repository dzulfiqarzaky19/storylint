// M2 — engine-owned types.
//
// PORTABLE MODULE BOUNDARY: no @/lib imports. The engine defines its OWN types
// so nothing under src/lib/websearch/ ever depends on storylint's domain, db,
// research, or ai modules. The app converts these at the adapter seam only.

/** A single search hit from any provider. */
export interface SearchResult {
  /** Absolute http(s) URL of the result. */
  url: string;
  /** Result title (may be empty). */
  title: string;
  /** Short snippet / summary from the search index (may be empty). */
  snippet: string;
  /** Which provider produced this hit (e.g. "searxng", "wikipedia"). */
  source: string;
}

/**
 * A search backend. Implementations return [] on any failure (never throw) so
 * the compose layer can fall through to the next provider. This "never throw,
 * return []" contract is the fail-soft spine of the whole engine.
 */
export interface SearchProvider {
  /** Stable provider name, surfaced in SearchResult.source. */
  readonly name: string;
  /** Run a query; resolve to hits, or [] on any error. Never throws. */
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}

/** The full-body read of one page. */
export interface ReadResult {
  /** The URL that was actually read (post-redirect). */
  url: string;
  /** Page title, best-effort. */
  title: string;
  /**
   * FULL body content as markdown (never truncated/compacted). This is
   * TEXT-for-LLM, never mounted as live HTML. The XSS control is applied to
   * this markdown at the OUTPUT boundary (ground/sanitizeMarkdown).
   */
  markdown: string;
}

/**
 * What the engine hands the app: the results it searched plus the pages it
 * managed to read. `read` may be shorter than `results` (some reads fail /
 * return null). Empty everywhere is the valid "found nothing" state.
 */
export interface RetrievalResult {
  query: string;
  results: SearchResult[];
  read: ReadResult[];
}

/** Runtime guard: is `value` a usable absolute http(s) URL string? */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}
