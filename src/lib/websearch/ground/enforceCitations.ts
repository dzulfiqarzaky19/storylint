// M7 — citation grounding guard.
//
// PORTABLE MODULE BOUNDARY: node builtins + siblings only.
//
// The research model is instructed to cite only pages the engine actually read.
// This guard enforces that mechanically: any absolute-http(s) markdown link
// whose URL is NOT in the allowed set (the URLs actually retrieved) is a
// hallucinated citation. We neutralize it to its visible text so the UI never
// renders a fabricated source link. Relative/anchor links are left alone (they
// are in-document navigation, not external citations).

/** Normalize a URL for comparison: lowercase host, drop a single trailing slash. */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    let out = u.href;
    // Collapse a lone trailing slash on the path so "…/a" and "…/a/" match.
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Neutralize any absolute http(s) markdown-link citation whose URL is not in
 * `allowedUrls`, preserving its visible text. Relative/anchor links pass
 * through untouched. Returns the grounded markdown.
 */
export function enforceCitations(markdown: string, allowedUrls: readonly string[]): string {
  if (typeof markdown !== "string" || markdown.length === 0) return markdown;

  const allowed = new Set<string>();
  for (const u of allowedUrls) {
    const n = normalizeUrl(u);
    if (n) allowed.add(n);
  }

  const linkPattern = /(!?)\[([^\]]*)\]\(\s*([^)\s]*)\s*\)/g;

  return markdown.replace(linkPattern, (match, bang: string, text: string, url: string) => {
    const normalized = normalizeUrl(url);
    // Not an absolute http(s) URL (relative/anchor/other) => leave untouched.
    if (normalized === null) return match;
    // Absolute citation: keep only if it was actually retrieved.
    if (allowed.has(normalized)) return match;
    return `${bang}${text}`;
  });
}
