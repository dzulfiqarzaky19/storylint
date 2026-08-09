/**
 * Consistency-check engine — public surface (Phase 2, TDD).
 *
 * This module is intentionally PURE: no React, no DB, no network, no AI.
 * `checkManuscript` is the single entry point (HANDOFF §7). It runs on the
 * server at page load and on the client debounced ~300ms as the user types.
 *
 * NOTE: This file currently exports the SIGNATURE ONLY plus a stub that
 * returns an empty result. The real logic (Pass A contradiction, Pass B
 * unrecorded, normalization, markKey hashing) is implemented in a later
 * phase against the failing test suite in tests/check/*.
 */

// ---------------------------------------------------------------------------
// Domain types
//
// No src/lib/domain/types.ts exists on disk yet, so the wiki-snapshot shape the
// engine consumes is defined here. When the domain layer lands it should either
// re-export these or these should move there; the field names below mirror the
// seed data in HANDOFF §6 (entries/facts/ties/aliases).
// ---------------------------------------------------------------------------

export type EntryKind = 'character' | 'world' | 'organization' | 'lore';

/** A single recorded fact on an entry, e.g. { key: 'Eyes', value: 'Green' }. */
export interface WikiFact {
  id: string;
  entryId: string;
  key: string;
  value: string;
}

/** A wiki entry (a "gazetteer" record) with its recorded facts. */
export interface WikiEntry {
  id: string;
  kind: EntryKind;
  name: string;
  /** Optional alternate names/aliases the lexicon should treat as "written down". */
  aliases?: string[];
  /** Free-text note/summary; contributes to the lexicon and to entry references. */
  note?: string;
  facts: WikiFact[];
}

/**
 * The read-model the engine checks the manuscript against. This is the user's
 * own wiki, "read back at them" — the engine never invents anything not here.
 */
export interface WikiSnapshot {
  entries: WikiEntry[];
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Two signals, never merged (product rule 2):
 *   - 'conflict' → the manuscript contradicts the wiki (solid red underline).
 *   - 'missing'  → the manuscript mentions something not yet written down
 *                  (dotted grey underline).
 */
export type MarkKind = 'conflict' | 'missing';

/**
 * The rail kind LABEL shown above a mark's reason (HANDOFF §6 "Rail kind
 * labels"). This is derived from `Mark.kind` ('conflict' → 'Contradiction',
 * 'missing' → 'Unrecorded'); it is NOT the `Mark.rail` field, which carries the
 * short reason sentence.
 */
export type MarkRailLabel = 'Contradiction' | 'Unrecorded';

/** Maps a mark kind to its rail kind label. */
export function railLabel(kind: MarkKind): MarkRailLabel {
  return kind === 'conflict' ? 'Contradiction' : 'Unrecorded';
}

/**
 * A single note action offered under a mark. `id` is the stable action key the
 * resolveMark server action dispatches on; `label` is the user-facing copy.
 */
export interface MarkAction {
  id: string;
  label: string;
}

/**
 * A stable, offset-free position for a mark. Recomputed on every check so a
 * mark survives the paragraph moving in the document.
 */
export interface MarkPosition {
  paragraphIndex: number;
  /** 0-based index of this quote occurrence within its paragraph. */
  occurrenceIndex: number;
}

/**
 * A rendered consistency mark.
 *
 * `markKey = sha1(ruleId | normalizedQuote | entryId)` — stable across edits so
 * resolvedMarks persists by key even after the paragraph moves.
 */
export interface Mark {
  markKey: string;
  kind: MarkKind;
  ruleId: string;
  /** The manuscript text run this mark underlines (curly quotes preserved). */
  quote: string;
  /** Short one-line reason shown on the rail row. */
  rail: string;
  /** Longer explanatory note shown in the inline note under the paragraph. */
  noteText: string;
  actions: MarkAction[];
  position: MarkPosition;
  /**
   * The wiki entry this mark is anchored to, when the engine knows it: the fact's
   * owner for a contradiction, the referenced entity for an unrecorded detail, or
   * the model-echoed entryId for an AI conflict. Empty for AI `missing` marks
   * (nothing recorded to anchor to yet). Lets explainMark retrieve that exact
   * entry (focusEntityIds) instead of re-deriving it from a substring scan.
   */
  entityId?: string;
  /**
   * How strongly the manuscript leans on this phrase, used to RANK the rail (a
   * higher-importance row sorts first). It is never a gate: a single-mention
   * mark still surfaces, it just ranks lower. Optional so contradiction marks
   * and older callers stay valid.
   *
   *   'high'   - the author leans on this (recurs within/across chapters, or the
   *              AI judged it pivotal).
   *   'normal' - a first, ordinary mention (default).
   *   'low'    - background detail (reserved for future AI down-ranking).
   */
  importance?: MarkImportance;
  /** Times this phrase occurs in the current chapter (>=1). Drives importance. */
  recurrence?: number;
}

export type MarkImportance = 'high' | 'normal' | 'low';

/** Sort weight so 'high' rows come first; unknown/undefined sorts as 'normal'. */
export function importanceRank(importance?: MarkImportance): number {
  switch (importance) {
    case 'high':
      return 0;
    case 'low':
      return 2;
    default:
      return 1; // 'normal' or undefined
  }
}

/**
 * The projection of a `missing` mark onto the Wiki poster band. Same run that
 * produces `missing` marks produces these — never seeded as static data.
 */
export interface Suggestion {
  /** Chapter this was found in, e.g. "Chapter 7". */
  source: string;
  /** Display text shown on the suggestion card. */
  text: string;
  /** Fact key it would become, e.g. "Carries" / "Rule". */
  key: string;
  /** Fact value it would become. */
  value: string;
}

/** Input to the single engine entry point. */
export interface CheckInput {
  paragraphs: string[];
  wiki: WikiSnapshot;
  focusEntryId?: string;
  /** markKeys the user already resolved; their marks are suppressed. */
  resolvedMarkKeys?: string[];
  /** suggestion keys the user dismissed ("Leave it"); suppressed. */
  dismissedSuggestionKeys?: string[];
  /**
   * Book-wide index of candidate phrases → how many chapters each appears in
   * (from phrase_mentions). Lets the engine RANK an unrecorded mark by
   * cross-chapter recurrence (Tier 2). Keys are lowercased (see
   * extractCandidatePhrases). Omitted → within-chapter ranking only (Tier 1).
   */
  chapterCounts?: ReadonlyMap<string, number>;
}

/** Output of the engine. */
export interface CheckResult {
  marks: Mark[];
  suggestions: Suggestion[];
}

// ---------------------------------------------------------------------------
// Entry point — orchestrates Pass A (contradiction) and Pass B (unrecorded).
// ---------------------------------------------------------------------------

import { findContradictions } from './contradiction';
import { findUnrecorded } from './unrecorded';
import { buildLexicon } from './lexicon';
import { projectSuggestion } from './suggestions';

export { normalize } from './normalize';

/**
 * The single, pure entry point (HANDOFF §7). One run produces BOTH marks and
 * suggestions: suggestions are the projection of `missing` marks, so seeding
 * them separately would be a bug.
 */
export function checkManuscript(input: CheckInput): CheckResult {
  const { paragraphs, wiki, resolvedMarkKeys, dismissedSuggestionKeys, chapterCounts } = input;

  const resolved = new Set(resolvedMarkKeys ?? []);
  const dismissed = new Set(dismissedSuggestionKeys ?? []);

  const lexicon = buildLexicon(wiki);

  const contradictions = findContradictions(paragraphs, wiki);
  const unrecorded = findUnrecorded(paragraphs, wiki, lexicon, chapterCounts);

  const marks: Mark[] = [...contradictions, ...unrecorded].filter(
    (m) => !resolved.has(m.markKey),
  );

  // Suggestions are the projection of the surviving `missing` marks.
  const suggestions: Suggestion[] = marks
    .filter((m) => m.kind === 'missing')
    .map((m) => projectSuggestion(m))
    .filter((s): s is Suggestion => s !== null)
    .filter((s) => !dismissed.has(s.key));

  return { marks, suggestions };
}
