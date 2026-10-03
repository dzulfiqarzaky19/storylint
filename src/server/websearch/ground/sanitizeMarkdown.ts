const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const NEUTRAL_URL = "#";

function isSafeLinkUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (url.length === 0) return true;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!schemeMatch) {
    return true;
  }
  const scheme = `${(schemeMatch[1] ?? "").toLowerCase()}:`;
  return SAFE_SCHEMES.has(scheme);
}

export function sanitizeMarkdown(markdown: string): string {
  if (typeof markdown !== "string" || markdown.length === 0) return markdown;

  const linkPattern = /(!?)\[([^\]]*)\]\(\s*([^)\s]*)\s*\)/g;

  return markdown.replace(linkPattern, (match, bang: string, text: string, url: string) => {
    if (isSafeLinkUrl(url)) return match;
    return `${bang}[${text}](${NEUTRAL_URL})`;
  });
}
