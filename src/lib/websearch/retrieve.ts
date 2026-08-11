// M8 — the engine entrypoint.
//
// PORTABLE MODULE BOUNDARY: node builtins + linkedom + defuddle + siblings only.
// NOTHING here imports @/lib/domain, @/lib/db, @/lib/research, or @/lib/ai. The
// app talks to this one function and converts its RetrievalResult at the adapter
// seam.
//
// Pipeline: search (compose providers) -> read the top-N hits to full-body
// markdown (SSRF-guarded) -> sanitize each page's markdown at the output
// boundary. Fail-soft end to end: search failure => empty run; a single page's
// read failure drops only that page.

import type {
  ReadResult,
  RetrievalResult,
  SearchResult,
  SearchProvider,
} from "@/lib/websearch/types";
import type { WebSearchConfig } from "@/lib/websearch/search/config";
import { composeSearch, buildProviders } from "@/lib/websearch/search";
import { readPage } from "@/lib/websearch/read/reader";
import { sanitizeMarkdown } from "@/lib/websearch/ground/sanitizeMarkdown";

/** Search seam: query -> hits (never throws in production; guarded here anyway). */
export type SearchImpl = (query: string, signal?: AbortSignal) => Promise<SearchResult[]>;

/** Read seam: url -> full-body ReadResult, or null when unreadable. */
export type ReadImpl = (url: string, signal?: AbortSignal) => Promise<ReadResult | null>;

export interface RetrieveOptions {
  /** Injectable search (default: composeSearch over built providers). */
  searchImpl?: SearchImpl;
  /** Injectable read (default: the real SSRF-guarded readPage). */
  readImpl?: ReadImpl;
  /** Max pages to actually read (default: results length). */
  maxRead?: number;
  /** Optional abort signal, threaded to search + reads. */
  signal?: AbortSignal;
}

/**
 * Retrieve for a query: search, read the top-N hits to full-body markdown, and
 * ground (sanitize) each page. Never throws. Empty everywhere is the valid
 * "found nothing" outcome.
 */
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
    // OUTPUT-BOUNDARY grounding: neutralize dangerous URLs in the page markdown.
    read_.push({ ...page, markdown: sanitizeMarkdown(page.markdown) });
  }

  return { query, results, read: read_ };
}

/**
 * Convenience: build the default engine `searchImpl` from config (SearXNG floor
 * chain). The stream route uses this to wire `retrieve` without importing the
 * provider internals.
 */
export function buildSearchImpl(config: WebSearchConfig): SearchImpl {
  const providers: SearchProvider[] = buildProviders(config);
  return (query, signal) => composeSearch(query, providers, signal);
}
