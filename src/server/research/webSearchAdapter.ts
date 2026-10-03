import type { RetrievalResult } from "@/server/websearch/types";

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

export function collectAllowedUrls(retrieval: RetrievalResult): string[] {
  return retrieval.read.map((page) => page.url);
}
