import type { Mark } from '@/lib/check';

/**
 * How a confirmed /write picker enrich should hit the wiki: correct the fact the
 * signal contradicted (edit in place) versus append a new fact to a known entry.
 *
 * WHY this exists as its own decision: resolving a CONTRADICTION must EDIT the one
 * conflicting fact, not stack a second fact beside it — otherwise the wiki ends up
 * holding BOTH the old (contradicted) value and the correction, and the next check
 * flags the same conflict again. The signal that a real row is being corrected is
 * ANY conflict mark (AI or deterministic-rule) whose resolved `checkedAgainst
 * .factId` points at an actual facts row. Absent that factId — a conflict never
 * matched to a row, or any non-conflict enrich — there is no row to correct, so
 * appending a new fact is the right write.
 *
 * Pure + exported so the routing is unit-testable (the component just dispatches
 * on the returned mode); the modal-confirm gate (product rule 1) is unchanged.
 */
export type WikiWriteMode =
  | { mode: 'edit'; factId: string }
  | { mode: 'create' };

export function resolveWikiWriteMode(mark: Mark): WikiWriteMode {
  const factId = mark.checkedAgainst?.factId;
  if (mark.kind === 'conflict' && factId) {
    return { mode: 'edit', factId };
  }
  return { mode: 'create' };
}
