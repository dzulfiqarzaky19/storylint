/**
 * resolveChapterMarks — ONE source of truth for a chapter's marks
 * (T-SIDEBAR-RESOLVER).
 *
 * WHY: before this, the Write sidebar severity dot and the active chapter's rail
 * were computed from DIFFERENT sets — the sidebar dot ran regex-only over every
 * chapter (page.tsx buildSeverityByNumber), while the active rail merged regex
 * with cached AI marks (Manuscript rail = mergeMarks(initialMarks, initialAiMarks)).
 * So a chapter could show a sidebar notification and then, once opened, have an
 * empty rail (or vice versa). This function is the single resolver both surfaces
 * read, so they can never disagree.
 *
 * PURE: no DB / IO. The caller injects the already-loaded cache row; the resolver
 * only decides freshness and merges. Freshness reuses the SAME `hashValue` and
 * the SAME hashed inputs as production first paint (page.tsx hashes the chapter
 * `body` and the DB `wiki` snapshot; write.ts stamps the row from the identical
 * pair), so the resolver's gate is byte-identical to the persisted row's stamp —
 * it does NOT fork the hash.
 *
 * The merge (not replace) is deliberate: cached AI marks are AI-ONLY (the cache
 * persists aiMarksRef, not the merged set), so returning them alone would DROP
 * the regex marks the rail shows today — a regression. mergeMarks keeps every
 * regex mark and adds the AI ones (deterministic wins on the rare key collision).
 */

import { checkManuscript, type Mark } from '@/lib/check';
import { mergeMarks } from '@/lib/check/ai';
import { hashValue } from '@/lib/check/hash';
import { buildCheckInput } from '@/lib/write/adapters';
import type { WikiSnapshot as DbWiki, ChapterCheckCacheRow } from '@/lib/domain/types';

export interface ResolveChapterMarksArgs {
  /** Chapter body (ProseMirror doc JSON). */
  body: unknown;
  /** DB wiki snapshot — hashed for freshness and projected by buildCheckInput. */
  db: DbWiki;
  /** Book-wide resolved (dismissed) mark keys. */
  resolvedMarkKeys?: string[];
  /** Whether the AI cross-check feature is enabled for this request. */
  aiEnabled: boolean;
  /** The chapter's persisted AI-check cache row, or null when absent. */
  cacheRow: ChapterCheckCacheRow | null;
}

/**
 * Resolve the marks for ONE chapter, used identically for the sidebar severity
 * dot and (for the active chapter) the rail. See file header for the contract.
 */
export function resolveChapterMarks(args: ResolveChapterMarksArgs): Mark[] {
  const { body, db, resolvedMarkKeys, aiEnabled, cacheRow } = args;

  const regex = checkManuscript(
    buildCheckInput({ body, db, resolvedMarkKeys }),
  ).marks;

  const fresh =
    aiEnabled &&
    cacheRow !== null &&
    cacheRow.bodyHash === hashValue(body) &&
    cacheRow.wikiHash === hashValue(db);

  if (!fresh) return regex;

  return mergeMarks(regex, cacheRow.marks as Mark[]);
}
