function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    let out = u.href;
    if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
    return out.toLowerCase();
  } catch {
    return null;
  }
}

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
    if (normalized === null) return match;
    if (allowed.has(normalized)) return match;
    return `${bang}${text}`;
  });
}
