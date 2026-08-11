// M6 — full-body page reader.
//
// PORTABLE MODULE BOUNDARY: node builtins + linkedom + defuddle + siblings.
//
// Pipeline: safeFetch (SSRF-guarded) -> linkedom parseHTML -> defuddle/node
// {markdown:true} -> FULL body markdown. NO compaction / truncation here; the
// only size limit is the ~5MB FETCH byte-cap in safeFetch (OOM safety).
//
// WHY NO DOMPurify/jsdom: the extracted markdown is TEXT-for-LLM, never mounted
// as live HTML (Turn.tsx renders {turn.text} = escaped React text). The XSS
// control lives at the OUTPUT boundary (ground/sanitizeMarkdown), applied to
// this markdown before it reaches the model/UI.

import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

import type { ReadResult } from "@/lib/websearch/types";
import {
  safeFetch,
  type SafeFetchResult,
  type SafeFetchOptions,
} from "@/lib/websearch/read/safeFetch";

/** safeFetch seam: injectable so the reader can be unit-tested without network. */
export type SafeFetchImpl = (
  url: string,
  opts?: SafeFetchOptions,
) => Promise<SafeFetchResult>;

export interface ReadPageOptions extends SafeFetchOptions {
  /** Injectable fetch (default: the real SSRF-guarded safeFetch). */
  safeFetchImpl?: SafeFetchImpl;
}

/**
 * Read one page to FULL-body markdown. Returns null (never throws) when the URL
 * is unsafe / unreachable, or when extraction yields nothing usable — the
 * caller then falls back to the search snippet.
 */
export async function readPage(
  url: string,
  opts: ReadPageOptions = {},
): Promise<ReadResult | null> {
  const fetchImpl = opts.safeFetchImpl ?? safeFetch;

  let fetched: SafeFetchResult;
  try {
    fetched = await fetchImpl(url, opts);
  } catch {
    // Unsafe URL / network / timeout => skip (fail-soft).
    return null;
  }

  try {
    const { document } = parseHTML(fetched.body);
    const result = await Defuddle(document, fetched.url, {
      markdown: true,
      useAsync: false,
    });
    const markdown = typeof result.content === "string" ? result.content.trim() : "";
    // Empty extraction => null so the caller uses the snippet instead.
    if (markdown.length === 0) return null;

    const title =
      (typeof result.title === "string" && result.title.trim()) ||
      fetched.url;
    return { url: fetched.url, title, markdown };
  } catch {
    // Parse / extraction failure => skip (fail-soft).
    return null;
  }
}
