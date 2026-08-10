import type { EntryWithDetails } from "@/lib/domain/types";

/**
 * Build the one-line-per-entry gazetteer string the research AI grounds on.
 *
 * F5 (fully-free research chat): the AI ALWAYS sees the ENTIRE wiki — there is
 * no scope narrowing. Every entry passed in is rendered; the caller passes the
 * whole snapshot's entries. Moved verbatim from the stream route's inline map
 * so the free-context decision is a pure, testable unit (F5-S1).
 *
 * Pure and non-mutating. Returns "" for an empty entry list; the prompt builder
 * turns that into an explicit "(empty)" gazetteer line.
 */
export function buildGazetteer(entries: EntryWithDetails[]): string {
  return entries
    .map((e) => {
      const facts = e.facts.map((f) => `${f.key}: ${f.value}`).join("; ");
      return `- ${e.name} (${e.kind})${e.summary ? ` — ${e.summary}` : ""}${facts ? ` [${facts}]` : ""}`;
    })
    .join("\n");
}
