/**
 * chapterSeverity — pure derive of a chapter's left-index dot severity from its
 * marks (Feature 1: chapter contradiction flags in the Write index).
 *
 * This module is intentionally PURE: no React, no DB, no network. It reads only
 * `Mark.kind` and mirrors the rail's own signal vocabulary (product rule 2: the
 * two signals are never merged). A contradiction dominates an unrecorded detail
 * because a red flag is the more urgent thing for the writer to see on the index.
 *
 *   'red'    — the chapter has at least one contradiction (kind === 'conflict').
 *   'yellow' — no contradiction, but at least one unrecorded (kind === 'missing').
 *   null     — the chapter is clean (no marks); the index renders no dot.
 *
 * The caller (write/page.tsx) forces the ACTIVE chapter to render no dot, since
 * the writer already sees its marks in the right rail — that is a rendering
 * decision, not part of this derive.
 */

import type { Mark } from './index';

/** A left-index dot severity, or null for a clean chapter (no dot). */
export type ChapterSeverity = 'red' | 'yellow' | null;

/**
 * Derive the single dot severity for a chapter from its marks. Conflict beats
 * missing beats clean, order-independently.
 */
export function chapterSeverity(marks: Mark[]): ChapterSeverity {
  if (marks.some((m) => m.kind === 'conflict')) return 'red';
  if (marks.some((m) => m.kind === 'missing')) return 'yellow';
  return null;
}

/**
 * The ACTIVE-chapter suppression guard, extracted PURE so it can be locked in
 * isolation. A dot renders iff the chapter has a severity AND it is not the
 * active chapter. This is the SECOND of two independent guards: the page also
 * nulls the active chapter's severity (see `buildSeverityByNumber`). Each guard
 * is defensible belt-and-suspenders on its own; because they double-cover, only
 * a unit test that drops ONE guard in isolation can prove that guard — an e2e
 * cannot, since the other guard masks it. Dropping the `!== selectedNumber` term
 * makes an active chapter with a severity return `true` (renders a dot).
 */
export function shouldShowChapterDot(
  severity: ChapterSeverity | undefined,
  chapterNumber: number,
  selectedNumber: number,
): boolean {
  return severity != null && chapterNumber !== selectedNumber;
}

/**
 * Build the per-chapter severity map the Write page passes to the index,
 * extracted PURE (engine call injected as `computeFn`) so the ACTIVE-null force
 * can be locked in isolation. The active chapter maps to `null` (the writer sees
 * its marks in the right rail, so a dot would be redundant); every other chapter
 * maps to `computeFn(body)`. This is the FIRST of the two independent guards
 * (the render guard is `shouldShowChapterDot`). Removing the active-null branch
 * makes the active chapter map to its real severity.
 */
export function buildSeverityByNumber<T extends { number: number; body: unknown }>(
  chapters: readonly T[],
  activeNumber: number,
  computeFn: (body: unknown) => ChapterSeverity,
): Map<number, ChapterSeverity> {
  const byNumber = new Map<number, ChapterSeverity>();
  for (const c of chapters) {
    byNumber.set(c.number, c.number === activeNumber ? null : computeFn(c.body));
  }
  return byNumber;
}
