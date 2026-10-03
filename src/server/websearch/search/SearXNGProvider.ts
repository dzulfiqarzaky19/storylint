import type { SearchProvider, SearchResult } from "@/server/websearch/types";
import { isHttpUrl } from "@/server/websearch/types";
import type { ProviderFetch } from "@/server/websearch/search/SearchProvider";

const DEFAULT_TIMEOUT_MS = 8000;

interface SearXNGResult {
  url?: unknown;
  title?: unknown;
  content?: unknown;
}

interface SearXNGResponse {
  results?: unknown;
}

export interface SearXNGOptions {
  fetchImpl?: ProviderFetch;
  timeoutMs?: number;
  maxResults?: number;
}

export class SearXNGProvider implements SearchProvider {
  readonly name = "searxng";
  private readonly base: string;
  private readonly fetchImpl: ProviderFetch;
  private readonly timeoutMs: number;
  private readonly maxResults: number;

  constructor(baseUrl: string, opts: SearXNGOptions = {}) {
    this.base = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResults = opts.maxResults ?? 10;
  }

  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const url = `${this.base}/search?q=${encodeURIComponent(query)}&format=json`;
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const res = await this.fetchImpl(url, { signal: combined });
      if (res.status < 200 || res.status >= 300) return [];

      let data: SearXNGResponse;
      try {
        data = (await res.json()) as SearXNGResponse;
      } catch {
        return [];
      }

      const raw = data.results;
      if (!Array.isArray(raw)) return [];

      const out: SearchResult[] = [];
      for (const r of raw as SearXNGResult[]) {
        const u = typeof r.url === "string" ? r.url : "";
        if (!isHttpUrl(u)) continue;
        out.push({
          url: u,
          title: typeof r.title === "string" ? r.title : "",
          snippet: typeof r.content === "string" ? r.content : "",
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
