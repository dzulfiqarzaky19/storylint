// M7 — OUTPUT-boundary markdown sanitizer.
//
// PORTABLE MODULE BOUNDARY: node builtins + siblings only.
//
// The reader (read/reader.ts) is deliberately DOMPurify-free and jsdom-free:
// extracted page markdown is TEXT-for-LLM, never mounted as live HTML. The XSS
// control lives HERE, at the output boundary, and is applied to any markdown
// (read pages AND model output) before it reaches the model context or the UI.
//
// Threat: a markdown link/image whose URL carries an executable scheme
// (javascript:, data:, vbscript:, file:) — if such markdown were ever rendered
// to real HTML, the href would execute. We rewrite any non-http(s), non-relative
// URL to "#", preserving the visible link/alt text. Prose that merely mentions
// "javascript" is untouched: only URLs inside markdown link/image syntax are
// inspected.

/** Schemes permitted in a markdown link/image URL. Everything else is neutralized. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/** The neutral href a dangerous URL is rewritten to. */
const NEUTRAL_URL = "#";

/**
 * Is this markdown-link URL safe to keep as-is?
 * - relative ("/x", "./x", "../x") and anchor ("#x") URLs are safe (no scheme).
 * - absolute URLs are safe ONLY if their scheme is in SAFE_SCHEMES.
 */
function isSafeLinkUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (url.length === 0) return true;
  // Relative / anchor / protocol-relative-safe: no scheme colon before a slash.
  // A scheme is [a-z][a-z0-9+.-]* followed by ":".
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!schemeMatch) {
    // No scheme => relative or anchor => safe.
    return true;
  }
  const scheme = `${(schemeMatch[1] ?? "").toLowerCase()}:`;
  return SAFE_SCHEMES.has(scheme);
}

/**
 * Neutralize dangerous URLs inside markdown link `[text](url)` and image
 * `![alt](url)` syntax, preserving the visible text. Non-link prose is
 * untouched. Returns the sanitized markdown.
 */
export function sanitizeMarkdown(markdown: string): string {
  if (typeof markdown !== "string" || markdown.length === 0) return markdown;

  // Matches optional leading "!" (image), the [text] group, then (url) where url
  // is everything up to the closing paren that is not itself a paren/space-only.
  // We capture the URL loosely and validate the scheme ourselves.
  const linkPattern = /(!?)\[([^\]]*)\]\(\s*([^)\s]*)\s*\)/g;

  return markdown.replace(linkPattern, (match, bang: string, text: string, url: string) => {
    if (isSafeLinkUrl(url)) return match;
    return `${bang}[${text}](${NEUTRAL_URL})`;
  });
}
