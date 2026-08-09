/**
 * selectGazetteer — retrieval for the AI prompt (scale/cost fix G1/G4/M4).
 *
 * The AI actions (aiCheckChapter, explainMark) used to inline the ENTIRE wiki
 * into every prompt. That makes each call's token cost grow with WORLD size even
 * when the writer edited one paragraph, so it does not scale to a large book.
 *
 * This helper sends only the entities the prose actually leans on:
 *   - focusEntityIds  : always included (an exact anchor, e.g. a mark's entity).
 *   - exact matches   : entities whose name / a fact value appears in the text.
 *   - 1-hop ties      : the tied entities of any included entity (relational
 *                       contradictions like "her husband" need the spouse record).
 *   - speculative tail: looser token-only matches, ranked and truncated by the cap.
 *
 * The cap is a FLOOR-PROTECTED CEILING: pinned entities (focus + exact + ties) are
 * NEVER dropped, because importance is rank-not-gate and a single-mention heirloom
 * must never be silently discarded. Only the speculative tail is truncated; if the
 * pinned set alone exceeds maxEntries, the cap is raised for that call rather than
 * dropping a real mention.
 *
 * Operates on the RICH DbWiki (EntryWithDetails), NOT the pruned check-engine
 * WikiSnapshot: ties live only on the rich shape and are load-bearing here. The
 * deterministic engine keeps its own pruned input; two consumers, two shapes.
 *
 * ALIAS RECALL is deferred: there is no alias column in the DB yet (the check-layer
 * `aliases?` field is unpopulated). The matcher is structured so adding aliases is
 * one line, not a refactor. See _review_chick.md G1(a).
 */
import type { EntryWithDetails, WikiSnapshot } from "../domain/types";
import { normalize } from "../check/normalize";
import { words } from "../check/text";

/** Query describing what prose to retrieve gazetteer entries for. */
export interface GazetteerQuery {
  /**
   * The prose to scan for entity mentions.
   *   aiCheckChapter: the manuscript paragraphs (full body is in hand).
   *   explainMark:    the flagged quote + its sentence + paragraph.
   */
  text: string;
  /** Entities to include UNCONDITIONALLY (exact anchors), e.g. a mark's entity. */
  focusEntityIds?: string[];
  /** Soft ceiling on entries returned. Pinned entities can push past it. Default 15. */
  maxEntries?: number;
}

/** Result of a selection, with a dev-facing reason per entry (for tuning/telemetry). */
export interface GazetteerSelection {
  entries: EntryWithDetails[];
  /** True when the pinned set alone exceeded maxEntries (cap was raised). */
  capRaised: boolean;
}

const DEFAULT_MAX_ENTRIES = 15;

// Content stopwords: a name whose only tokens are these is too weak to match on
// token-fallback alone (mirrors the spirit of lexicon.ts STOPWORDS).
const STOPWORDS = new Set([
  "a", "an", "the", "her", "his", "their", "its", "my", "your", "own",
  "of", "and", "in", "on", "at", "to", "with", "since",
]);

/** Normalized content tokens of a phrase (stopwords + empties removed). */
function contentTokens(phrase: string): string[] {
  return words(phrase)
    .map((w) => normalize(w))
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * How strongly `text` (already normalized + its token set) mentions one entity.
 * Returns a match tier:
 *   'exact' - the entity name (normalized) or a fact value appears as a substring.
 *   'token' - every content token of the name is individually present (looser).
 *   null    - not mentioned.
 * Alias matching would slot in here as another 'exact' source when aliases exist.
 */
function matchTier(
  entry: EntryWithDetails,
  normText: string,
  textTokens: Set<string>,
): "exact" | "token" | null {
  const name = normalize(entry.name);
  if (name.length >= 3 && normText.includes(name)) return "exact";

  // Fact values are exact, checkable claims; a value appearing verbatim is a
  // strong signal the paragraph is talking about this entity.
  for (const fact of entry.facts) {
    const v = normalize(fact.value);
    if (v.length >= 3 && normText.includes(v)) return "exact";
    // Split multi-clause values so each clause is independently matchable.
    for (const part of fact.value.split(/[,;·]/)) {
      const p = normalize(part);
      if (p.length >= 4 && normText.includes(p)) return "exact";
    }
  }

  // Token fallback: every content token of the name is present (order-free). This
  // catches "the Verge light" for entry "Verge Light" without a substring hit.
  const nameTokens = contentTokens(entry.name);
  if (nameTokens.length > 0 && nameTokens.every((t) => textTokens.has(t))) {
    return "token";
  }
  return null;
}

/**
 * Select the gazetteer subset relevant to `q.text`. Pure and dependency-free so
 * it is fully unit-testable without a DB or a model.
 */
export function selectGazetteer(
  wiki: WikiSnapshot,
  q: GazetteerQuery,
): GazetteerSelection {
  const maxEntries = q.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const focus = new Set(q.focusEntityIds ?? []);

  const normText = normalize(q.text);
  const textTokens = new Set(contentTokens(q.text));

  // Classify every entry once.
  const pinned = new Set<string>(); // focus + exact matches + their ties
  const speculative: { id: string; mentions: number }[] = [];

  for (const entry of wiki.entries) {
    if (focus.has(entry.id)) {
      pinned.add(entry.id);
      continue;
    }
    const tier = matchTier(entry, normText, textTokens);
    if (tier === "exact") {
      pinned.add(entry.id);
    } else if (tier === "token") {
      // How many distinct name tokens hit, as a cheap relevance rank for the tail.
      const hits = contentTokens(entry.name).filter((t) => textTokens.has(t)).length;
      speculative.push({ id: entry.id, mentions: hits });
    }
  }

  // 1-hop ties of every pinned entity are pinned too (relational backstop). byId
  // gives O(1) lookup; a tie's toEntryId is the neighbour. Guard the shape: a
  // malformed snapshot (missing byId/ties) must degrade to "no expansion", never
  // throw, since this sits on the AI save path.
  const byId = wiki.byId ?? {};
  for (const id of [...pinned]) {
    const entry = byId[id];
    if (!entry) continue;
    for (const tie of entry.ties ?? []) {
      if (byId[tie.toEntryId]) pinned.add(tie.toEntryId);
    }
  }

  // Rank the speculative tail by mention strength (desc), stable by original order.
  speculative.sort((a, b) => b.mentions - a.mentions);

  // Floor-protected cap: pinned always survive. Fill remaining room from the tail.
  const capRaised = pinned.size > maxEntries;
  const room = Math.max(0, maxEntries - pinned.size);
  const tailIds = new Set(speculative.slice(0, room).map((s) => s.id));

  // Preserve original wiki order for a stable, readable prompt.
  const entries = wiki.entries.filter(
    (e) => pinned.has(e.id) || tailIds.has(e.id),
  );

  return { entries, capRaised };
}

/**
 * M5 (silent-false-negative guard): given the entryIds the model ECHOED and the
 * entryIds we actually SENT in the pruned gazetteer, return the echoed ids that
 * were NOT sent. A non-empty result means retrieval under-selected: the model
 * referenced an entity we did not ground it on, so any contradiction against that
 * entity could be silently missed.
 *
 * Pure and side-effect-free (the dev-only logging lives at the call site). Blanks
 * and already-sent ids are ignored; the result is de-duplicated and order-stable.
 */
export function findRetrievalMisses(
  echoedEntryIds: readonly (string | undefined)[],
  sentEntryIds: readonly string[],
): string[] {
  const sent = new Set(sentEntryIds);
  const misses: string[] = [];
  const seen = new Set<string>();
  for (const raw of echoedEntryIds) {
    const id = (raw ?? "").trim();
    if (!id || sent.has(id) || seen.has(id)) continue;
    seen.add(id);
    misses.push(id);
  }
  return misses;
}
