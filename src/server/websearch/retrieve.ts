import type {
  ReadResult,
  RetrievalResult,
  SearchResult,
  SearchProvider,
} from "@/server/websearch/types";
import type { WebSearchConfig } from "@/server/websearch/search/config";
import { composeSearch, buildProviders } from "@/server/websearch/search";
import { readPage } from "@/server/websearch/read/reader";
import { sanitizeMarkdown } from "@/server/websearch/ground/sanitizeMarkdown";

export type SearchImpl = (query: string, signal?: AbortSignal) => Promise<SearchResult[]>;

export type ReadImpl = (url: string, signal?: AbortSignal) => Promise<ReadResult | null>;

export interface RetrieveOptions {
  searchImpl?: SearchImpl;
  readImpl?: ReadImpl;
  maxRead?: number;
  signal?: AbortSignal;
}

export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const search = opts.searchImpl;
  const read = opts.readImpl ?? ((url, signal) => readPage(url, { signal }));

  let results: SearchResult[] = [];
  try {
    results = search ? await search(query, opts.signal) : [];
  } catch {
    results = [];
  }

  const limit = opts.maxRead ?? results.length;
  const toRead = results.slice(0, limit);

  const read_: ReadResult[] = [];
  for (const hit of toRead) {
    let page: ReadResult | null = null;
    try {
      page = await read(hit.url, opts.signal);
    } catch {
      page = null;
    }
    if (page === null) continue;
    read_.push({ ...page, markdown: sanitizeMarkdown(page.markdown) });
  }

  return { query, results, read: read_ };
}

export function buildSearchImpl(config: WebSearchConfig): SearchImpl {
  const providers: SearchProvider[] = buildProviders(config);
  return (query, signal) => composeSearch(query, providers, signal);
}
