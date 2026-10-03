import type { SearchProvider, SearchResult } from "@/server/websearch/types";
import type { WebSearchConfig } from "@/server/websearch/search/config";
import { SearXNGProvider } from "@/server/websearch/search/SearXNGProvider";
import { WikipediaFloorProvider } from "@/server/websearch/search/WikipediaFloorProvider";

export type { SearchProvider, SearchResult } from "@/server/websearch/types";

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
