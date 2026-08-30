// Bridge the domain WikiSnapshot (DB read model) to the check engine's snapshot
// shape, run checkManuscript against the seeded chapter, and project the result
// into what the Wiki screen needs: poster suggestions (with a stable
// suggestionKey) and the set of entry ids carrying an unresolved contradiction
// (for the tile corner flag). "one engine, two screens".
//
// This keeps the Wiki poster band's suggestions DERIVED from the same engine run
// the Write screen uses — never seeded as static data.

import { checkManuscript } from "@/lib/check";
import { projectSuggestion } from "@/lib/check/suggestions";
import { toCheckWiki } from "@/lib/write/adapters";
import type { WikiSnapshot } from "./types";
import type { WikiSuggestion } from "@/lib/state/wikiStore";

/**
 * A suggestion's stable key. The engine's Suggestion carries `key`/`value` but
 * not the anchoring entry; the poster band needs both an entry to write the fact
 * onto and a persistence key for "Leave it". We key on the fact key + value,
 * which is stable for the seeded phrases and matches how dismissed_suggestions
 * persists. The target entry is the one the underlying `missing` mark anchored to.
 */
export interface CheckedWiki {
  suggestions: WikiSuggestion[];
  contradictionEntryIds: string[];
}

/** Extract the plain paragraph texts from a chapter's ProseMirror JSON body. */
export function paragraphsFromBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const doc = body as { content?: unknown };
  if (!Array.isArray(doc.content)) return [];
  const out: string[] = [];
  for (const node of doc.content) {
    if (!node || typeof node !== "object") continue;
    const n = node as { type?: string; content?: unknown };
    if (n.type !== "paragraph" || !Array.isArray(n.content)) continue;
    let text = "";
    for (const child of n.content) {
      const c = child as { type?: string; text?: string };
      if (c.type === "text" && typeof c.text === "string") text += c.text;
    }
    out.push(text);
  }
  return out;
}

/**
 * Run the check engine over the manuscript against the wiki and project the
 * result for the Wiki screen. Suppresses dismissed suggestions and resolved
 * marks so the poster and corner flags reflect persisted user decisions.
 */
export function checkWiki(input: {
  snapshot: WikiSnapshot;
  paragraphs: string[];
  dismissedSuggestionKeys: string[];
  resolvedMarkKeys: string[];
}): CheckedWiki {
  const { snapshot, paragraphs, dismissedSuggestionKeys, resolvedMarkKeys } = input;

  const { marks, suggestions } = checkManuscript({
    paragraphs,
    wiki: toCheckWiki(snapshot),
    resolvedMarkKeys,
    dismissedSuggestionKeys,
  });

  // Map each surviving suggestion back to the entry its `missing` mark anchored
  // to. `suggestions` is filtered by dismissals while `marks` is NOT, so a
  // positional zip (suggestions[i] <-> missingMarks[i]) breaks after any
  // dismissal and re-anchors a survivor to the wrong entry. Instead, match each
  // suggestion to the mark whose OWN projection produces the same key, so the
  // anchor is independent of how many earlier suggestions were dismissed.
  const missingMarks = marks.filter((m) => m.kind === "missing");
  const wikiSuggestions: WikiSuggestion[] = suggestions.map((s) => {
    const mark = missingMarks.find((m) => projectSuggestion(m)?.key === s.key);
    return {
      suggestionKey: s.key,
      entryId: mark ? entryForMark(mark.ruleId, mark.quote, snapshot) : "",
      key: s.key,
      value: s.value,
      text: s.text,
      source: s.source,
    };
  });

  const contradictionEntryIds = Array.from(
    new Set(
      marks
        .filter((m) => m.kind === "conflict")
        .map((m) => entryForMark(m.ruleId, m.quote, snapshot))
        .filter((id) => id !== ""),
    ),
  );

  return { suggestions: wikiSuggestions, contradictionEntryIds };
}

/**
 * Whole-book derive for the /wiki poster band (journey steps 3 + 6).
 *
 * The poster band shows the not-recorded details across the ACTIVE book, so a
 * detail the writer mentioned in ANY chapter surfaces here (not just a single
 * hardcoded chapter of the default book — the DUMMY this replaces). Runs the
 * SAME pure engine per chapter, unions the suggestions, and stamps each with its
 * REAL `Chapter N` source (replacing the DUMMY 'Chapter 7' source label).
 *
 * A phrase mentioned in several chapters yields one card, attributed to the
 * FIRST (earliest) chapter it appears in (deduped by suggestionKey), so the band
 * lists each unrecorded detail once. Contradiction entry ids are unioned across
 * all chapters for the tile corner flags.
 *
 * Deterministic only — no AI. Cost is O(sum of chapter lengths) per /wiki load,
 * which is why an AI cache is a SEPARATE concern (the AI layer, not this one).
 */
export function checkWikiBook(input: {
  snapshot: WikiSnapshot;
  chapters: { number: number; body: unknown }[];
  dismissedSuggestionKeys: string[];
  resolvedMarkKeys: string[];
}): CheckedWiki {
  const { snapshot, chapters, dismissedSuggestionKeys, resolvedMarkKeys } = input;

  const bySuggestionKey = new Map<string, WikiSuggestion>();
  const contradictionIds = new Set<string>();

  // Ascending chapter order so the FIRST-seen chapter wins as a suggestion's
  // source. getChaptersForBook already returns ordered rows, but sort defensively
  // so the "earliest chapter" invariant does not depend on the caller's order.
  const ordered = [...chapters].sort((a, b) => a.number - b.number);

  for (const ch of ordered) {
    const { suggestions, contradictionEntryIds } = checkWiki({
      snapshot,
      paragraphs: paragraphsFromBody(ch.body),
      dismissedSuggestionKeys,
      resolvedMarkKeys,
    });
    for (const s of suggestions) {
      if (bySuggestionKey.has(s.suggestionKey)) continue; // earliest chapter wins
      bySuggestionKey.set(s.suggestionKey, { ...s, source: `Chapter ${ch.number}` });
    }
    for (const id of contradictionEntryIds) contradictionIds.add(id);
  }

  return {
    suggestions: [...bySuggestionKey.values()],
    contradictionEntryIds: [...contradictionIds],
  };
}

// The engine does not expose the anchoring entryId on a Mark, so recover it the
// same way the rules do: a mark's quote references the subject entry. For the
// seeded manuscript the subject is the focus character (Maren) for the two
// conflicts, and the missing phrases attach to the entry whose note/facts the
// lexicon miss belongs to. We resolve conservatively by matching the quote's
// referenced entry name/pronoun; falling back to the focus entry.
function entryForMark(
  ruleId: string,
  quote: string,
  snapshot: WikiSnapshot,
): string {
  const q = quote.toLowerCase();
  // tallow rule -> Verge Light (the light's rule); brass ring / eyes / sworn -> Maren.
  if (q.includes("tallow")) {
    const vl = snapshot.entries.find((e) => e.name === "Verge Light");
    if (vl) return vl.id;
  }
  const maren = snapshot.entries.find((e) => e.name === "Maren Vell");
  return maren ? maren.id : (snapshot.entries[0]?.id ?? "");
}
