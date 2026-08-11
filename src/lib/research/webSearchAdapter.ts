// M9 — app-side web-search adapter seam.
//
// This is the ONE place storylint's app meets the portable engine. It imports
// the engine's TYPES (compile-time only) and the engine entrypoint at the route,
// and converts a RetrievalResult into prompt material. These two helpers are
// PURE and unit-tested; the impure wiring (config load, retrieve, Node runtime)
// lives in the stream route.
//
// NOTE ON BOUNDARY DIRECTION: the engine never imports the app. The app imports
// the engine. This file is on the APP side, so importing @/lib/websearch/* here
// is correct and expected.

import type { RetrievalResult } from "@/lib/websearch/types";

/**
 * Render the read pages into a prompt-context block for the user message. Empty
 * string when nothing was read, so the caller appends nothing and the answer
 * falls back to wiki-only grounding.
 *
 * The FULL body markdown is included verbatim (no truncation) — the whole point
 * of the reader. Each page is labeled with its post-redirect URL and title so
 * the model can cite it; enforceCitations later holds it to exactly these URLs.
 */
export function renderWebContext(retrieval: RetrievalResult): string {
  if (retrieval.read.length === 0) return "";

  const blocks = retrieval.read.map((page, i) => {
    const header = `[Source ${i + 1}] ${page.title} (${page.url})`;
    return `${header}\n${page.markdown}`;
  });

  return [
    "Web sources retrieved for this question (cite by their URL; do not cite any URL not listed here):",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}

/** The URLs of every read page — the allowed-citation set for enforceCitations. */
export function collectAllowedUrls(retrieval: RetrievalResult): string[] {
  return retrieval.read.map((page) => page.url);
}
