// M4 — SearchProvider re-export + shared provider fetch seam type.
//
// PORTABLE MODULE BOUNDARY: no @/lib imports. Re-exports the engine's own
// SearchProvider/SearchResult types so provider files import from one place.

export type { SearchProvider, SearchResult } from "@/lib/websearch/types";

/**
 * Injectable fetch seam for providers. Defaults to the global fetch; tests pass
 * a stub. Providers query OPERATOR-configured endpoints (SearXNG, Wikipedia),
 * not user-chosen URLs, so they do NOT use the SSRF safeFetch (that guards page
 * reads in M6).
 */
export type ProviderFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Response>;
