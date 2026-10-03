export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  source: string;
}

export interface SearchProvider {
  readonly name: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
}

export interface ReadResult {
  url: string;
  title: string;
  markdown: string;
}

export interface RetrievalResult {
  query: string;
  results: SearchResult[];
  read: ReadResult[];
}

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
