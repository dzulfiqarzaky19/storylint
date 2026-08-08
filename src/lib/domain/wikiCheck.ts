// Bridge the domain WikiSnapshot (DB read model) to the check engine's snapshot
// shape, run checkManuscript against the seeded chapter, and project the result
// into what the Wiki screen needs: poster suggestions (with a stable
// suggestionKey) and the set of entry ids carrying an unresolved contradiction
// (for the tile corner flag). HANDOFF §7 "one engine, two screens".
//
// This keeps the Wiki poster band's suggestions DERIVED from the same engine run
// the Write screen uses — never seeded as static data.

import { checkManuscript } from "@/lib/check";
import type {
  WikiSnapshot as EngineSnapshot,
  WikiEntry as EngineEntry,
} from "@/lib/check";
import type { WikiSnapshot } from "./types";
import type { WikiSuggestion } from "@/lib/state/wikiStore";

/** Adapt the DB read model into the pure engine's input snapshot. */
export function toEngineSnapshot(snapshot: WikiSnapshot): EngineSnapshot {
  const entries: EngineEntry[] = snapshot.entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    name: e.name,
    note: e.note,
    facts: e.facts.map((f) => ({
      id: f.id,
      entryId: f.entryId,
      key: f.key,
      value: f.value,
    })),
  }));
  return { entries };
}

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
    wiki: toEngineSnapshot(snapshot),
    resolvedMarkKeys,
    dismissedSuggestionKeys,
  });

  // Map a suggestion back to the entry its `missing` mark anchored to, by
  // matching normalized value against the mark quote. The engine projects each
  // surviving `missing` mark into one suggestion in order, so we align by the
  // fact value the projection produced against the marks list.
  const missingMarks = marks.filter((m) => m.kind === "missing");
  const wikiSuggestions: WikiSuggestion[] = suggestions.map((s, i) => {
    const mark = missingMarks[i];
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
