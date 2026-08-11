// M5 — search compose layer + provider assembly.
//
// PORTABLE MODULE BOUNDARY: node builtins + siblings only.

import type { SearchProvider, SearchResult } from "@/lib/websearch/types";
import type { WebSearchConfig } from "@/lib/websearch/search/config";
import { SearXNGProvider } from "@/lib/websearch/search/SearXNGProvider";
import { WikipediaFloorProvider } from "@/lib/websearch/search/WikipediaFloorProvider";

export type { SearchProvider, SearchResult } from "@/lib/websearch/types";

/**
 * Run providers IN ORDER, returning the first non-empty result set. A provider
 * that throws is treated as empty (fail-soft) and we fall through to the next.
 * Never throws.
 */
export async function composeSearch(
  query: string,
  providers: SearchProvider[],
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  for (const provider of providers) {
    let results: SearchResult[] = [];
    try {
      results = await provider.search(query, signal);
    } catch {
      results = [];
    }
    if (results.length > 0) return results;
  }
  return [];
}

/**
 * Assemble the provider chain for a config: SearXNG first WHEN configured, then
 * the Wikipedia floor. When SearXNG is unconfigured, only the floor runs.
 */
export function buildProviders(config: WebSearchConfig): SearchProvider[] {
  const providers: SearchProvider[] = [];
  if (config.enabled && config.searxngUrl) {
    providers.push(
      new SearXNGProvider(config.searxngUrl, {
        timeoutMs: config.fetchTimeoutMs,
        maxResults: config.maxResults,
      }),
    );
  }
  providers.push(new WikipediaFloorProvider({
    timeoutMs: config.fetchTimeoutMs,
    maxResults: config.maxResults,
  }));
  return providers;
}
