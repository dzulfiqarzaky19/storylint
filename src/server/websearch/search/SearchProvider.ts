export type { SearchProvider, SearchResult } from "@/server/websearch/types";

export type ProviderFetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Response>;
