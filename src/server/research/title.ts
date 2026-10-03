export const NEW_THREAD_TITLE = "New thread";

const MAX_WORDS = 6;
const MAX_CHARS = 48;
const ELLIPSIS = "\u2026";

export function deriveThreadTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (normalized === "") return NEW_THREAD_TITLE;

  const words = normalized.split(" ");
  let truncated = words.length > MAX_WORDS;
  let title = words.slice(0, MAX_WORDS).join(" ");

  if (title.length > MAX_CHARS) {
    title = title.slice(0, MAX_CHARS).trimEnd();
    truncated = true;
  }

  title = title.replace(/[\s.,;:!?]+$/, "");

  return truncated ? `${title}${ELLIPSIS}` : title;
}
