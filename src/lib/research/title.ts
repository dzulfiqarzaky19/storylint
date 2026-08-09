// Pure research-title derivation (F2a auto-title). No DB or React deps, so it is
// unit-testable and mutation-proven in isolation. The DB UPDATE and the
// "only when the title is empty or the 'New thread' placeholder" gate live in
// the mutation/action layer; this module owns ONLY the string derivation.

/** The placeholder title a freshly-created thread carries (see createThread). */
export const NEW_THREAD_TITLE = "New thread";

const MAX_WORDS = 6;
const MAX_CHARS = 48;
const ELLIPSIS = "\u2026"; // single-char … so the char cap is measured correctly

/**
 * Derive a thread title from the writer's first question. Collapses internal
 * whitespace, trims, strips trailing punctuation, then caps at ~6 words / 48
 * chars — appending an ellipsis whenever either cap actually truncates. An
 * empty or whitespace-only question falls back to the "New thread" placeholder
 * (the caller's gate then leaves the placeholder in place).
 */
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

  // Strip trailing punctuation/whitespace from the visible title either way.
  title = title.replace(/[\s.,;:!?]+$/, "");

  return truncated ? `${title}${ELLIPSIS}` : title;
}
