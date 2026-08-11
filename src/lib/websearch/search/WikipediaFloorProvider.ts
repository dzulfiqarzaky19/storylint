// M5 — Wikipedia floor search provider.
//
// PORTABLE MODULE BOUNDARY: node builtins + siblings only.
//
// A reliable baseline so the engine still returns SOMETHING when SearXNG is
// unconfigured or down. Uses the MediaWiki search API. Fail-soft: [] on any
// error, never throws.

import type { SearchProvider, SearchResult } from "@/lib/websearch/types";
import type { ProviderFetch } from "@/lib/websearch/search/SearchProvider";

const DEFAULT_TIMEOUT_MS = 8000;
const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKI_BASE = "https://en.wikipedia.org/wiki/";

interface WikiSearchHit {
  title?: unknown;
  snippet?: unknown;
}
interface WikiResponse {
  query?: { search?: unknown };
}

export interface WikipediaFloorOptions {
  fetchImpl?: ProviderFetch;
  timeoutMs?: number;
  maxResults?: number;
}

/** Strip the HTML tags MediaWiki puts in `snippet` (e.g. <span class=...>). */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export class WikipediaFloorProvider implements SearchProvider {
  readonly name = "wikipedia";
  private readonly fetchImpl: ProviderFetch;
  private readonly timeoutMs: number;
  private readonly maxResults: number;

  constructor(opts: WikipediaFloorOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResults = opts.maxResults ?? 5;
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const url =
      `${WIKI_API}?action=query&list=search&format=json&origin=*` +
      `&srlimit=${this.maxResults}&srsearch=${encodeURIComponent(query)}`;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const res = await this.fetchImpl(url, { signal: combined });
      if (res.status !== 200) return [];

      let data: WikiResponse;
      try {
        data = (await res.json()) as WikiResponse;
      } catch {
        return [];
      }

      const hits = data.query?.search;
      if (!Array.isArray(hits)) return [];

      const out: SearchResult[] = [];
      for (const h of hits as WikiSearchHit[]) {
        const title = typeof h.title === "string" ? h.title : "";
        if (!title) continue;
        const path = encodeURIComponent(title.replace(/ /g, "_"));
        out.push({
          url: `${WIKI_BASE}${path}`,
          title,
          snippet: typeof h.snippet === "string" ? stripHtml(h.snippet) : "",
          source: this.name,
        });
        if (out.length >= this.maxResults) break;
      }
      return out;
    } catch {
      return [];
    }
  }
}
