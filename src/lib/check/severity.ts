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
