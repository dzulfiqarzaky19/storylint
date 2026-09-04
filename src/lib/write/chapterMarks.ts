// =============================================================================
// A chapter's marks — ONE module that loads AND resolves (T-DEEP-3).
//
// The predecessor, `check/resolve.ts`, was pure by design: the CALLER loaded the
// cache row and the resolver only decided freshness and merged. That split is
// exactly what broke. Because the pure resolver could not fetch anything, the
// Write page had to fetch the open chapter's cache row itself — and then hand-
// write the freshness gate a SECOND time to use it. Two copies of one formula,
// in the module documented as "ONE source of truth" and in its only caller.
//
// So the module owns the whole question: the scope the snapshot is loaded at,
// the load ordering, the per-chapter AI-cache rows (only when AI is on), the
// recurrence counts for the open chapter — then resolves every chapter's marks
// through ONE freshness gate and ONE merge.
//
// What the caller no longer knows: the freshness formula, the load ordering,
// that the wiki snapshot must be read at (universe, book) scope, that cache rows
// are worth fetching only when AI is enabled, that the engine input is assembled
// by buildCheckInput, that the client's copy of the snapshot is the toCheckWiki
// projection, and that the active chapter's index dot is forced null.
//
// Reads arrive through ONE injected port (`ChapterMarksReader`), so this module
// imports no database and no gateway and the whole resolution is exercisable
// against a fake. The production adapter is `./chapterMarksReader`.
//
// Freshness reuses the SAME `hashValue` over the SAME inputs that `write.ts`
// stamps the cache row from, so this gate is byte-identical to the persisted
// stamp — it does NOT fork the hash.
//
// The merge (not replace) is deliberate: a cached row holds AI-ONLY marks, so
// returning them alone would DROP the deterministic marks the rail shows.
// mergeMarks keeps every deterministic mark and adds the AI ones (deterministic
// wins on the rare key collision — CONTEXT.md, "deterministic mark vs. AI mark").
// =============================================================================

import { checkManuscript, type Mark } from "@/lib/check";
import type { CheckWiki } from "@/lib/check";
import { mergeMarks } from "@/lib/check/ai";
import { hashValue } from "@/lib/check/hash";
import type { ChapterSeverity } from "@/lib/check/severity";
import { extractCandidatePhrases } from "@/lib/check/unrecorded";
import type { ChapterCheckCacheRow, WikiSnapshot as DbWiki } from "@/lib/domain/types";
import { buildCheckInput, docToParagraphs, toCheckWiki } from "./adapters";

/** One chapter of the active book, as this module needs to see it. */
export interface ChapterBody {
  id: string;
  number: number;
  body: unknown;
}

/**
 * Everything this module reads, as ONE port. The production adapter wraps the
 * query layer and the gateway check (`./chapterMarksReader`); a test passes a
 * fake and exercises the gate, the merge and the dot rules without a database.
 */
export interface ChapterMarksReader {
  /** The snapshot marks are resolved against — the scope IS part of the answer. */
  wikiSnapshot(universeId: string, bookId: string): Promise<DbWiki>;
  /** Book-wide dismissed mark keys. */
  resolvedMarkKeys(): Promise<string[]>;
  /** Every chapter of the active book, for the left-index dots. */
  bookChapters(bookId: string): Promise<ChapterBody[]>;
  /** Tier-2 recurrence counts for the open chapter's candidate phrases. */
  phraseChapterCounts(phrases: string[]): Promise<ReadonlyMap<string, number>>;
  /** A chapter's persisted AI-check row, or null when none is cached. */
  checkCache(chapterId: string): Promise<ChapterCheckCacheRow | null>;
  /** Whether the AI gateway is configured for this request. */
  aiEnabled(): boolean;
}

export interface ChapterMarksArgs {
  universeId: string;
  bookId: string;
  /** The chapter the writer has open. */
  chapterNumber: number;
  /** That chapter's body (already loaded for the editor). */
  body: unknown;
}

/** Everything the Write screen renders marks from, server and client alike. */
export interface ChapterMarks {
  /** Deterministic marks for the open chapter, so it is marked from first paint. */
  marks: Mark[];
  /** The open chapter's cached AI marks, or empty when stale / AI is off. */
  aiMarks: Mark[];
  /** Left-index dot per chapter number; the open chapter is forced null. */
  severityByNumber: Map<number, ChapterSeverity>;
  /** The snapshot the client re-runs the engine against on every keystroke. */
  wiki: CheckWiki;
  /** Book-wide dismissed mark keys, threaded to the client's re-check. */
  resolvedMarkKeys: string[];
  /** Tier-2 recurrence counts for the open chapter's candidate phrases. */
  chapterCounts: [string, number][];
}

/**
 * THE freshness gate. A cached AI row is valid only while BOTH the body it was
 * checked against and the wiki snapshot it was grounded in are unchanged.
 * Private on purpose: it existed twice because it was reachable.
 */
function isFresh(row: ChapterCheckCacheRow | null, body: unknown, db: DbWiki): boolean {
  return (
    row !== null && row.bodyHash === hashValue(body) && row.wikiHash === hashValue(db)
  );
}

/**
 * Resolve ONE chapter's marks: the deterministic run, plus that chapter's cached
 * AI marks when the gate says they are still fresh.
 */
function resolveOne(args: {
  body: unknown;
  db: DbWiki;
  resolvedMarkKeys: string[];
  aiOn: boolean;
  cacheRow: ChapterCheckCacheRow | null;
  chapterCounts?: ReadonlyMap<string, number>;
}): Mark[] {
  const deterministic = checkManuscript(
    buildCheckInput({
      body: args.body,
      db: args.db,
      resolvedMarkKeys: args.resolvedMarkKeys,
      chapterCounts: args.chapterCounts,
    }),
  ).marks;

  if (!args.aiOn || !isFresh(args.cacheRow, args.body, args.db)) return deterministic;
  return mergeMarks(deterministic, args.cacheRow!.marks as Mark[]);
}

/** A chapter's left-index dot: conflict beats missing beats clean. */
function severityOf(marks: Mark[]): ChapterSeverity {
  if (marks.some((m) => m.kind === "conflict")) return "red";
  if (marks.some((m) => m.kind === "missing")) return "yellow";
  return null;
}

/**
 * Load and resolve the marks for the open chapter and every sibling chapter's
 * index dot, against one wiki snapshot and one freshness gate.
 *
 * The index dot and the open chapter's rail cannot disagree, because they are
 * the same resolution over the same inputs — the bug this module exists to make
 * unrepresentable was a chapter showing a dot and then opening to an empty rail.
 */
export async function loadChapterMarks(
  args: ChapterMarksArgs,
  read: ChapterMarksReader,
): Promise<ChapterMarks> {
  const { universeId, bookId, chapterNumber, body } = args;

  const [db, resolvedMarkKeys, bookChapters] = await Promise.all([
    read.wikiSnapshot(universeId, bookId),
    read.resolvedMarkKeys(),
    read.bookChapters(bookId),
  ]);

  // Tier-2 recurrence ranking, for the OPEN chapter only: DISTINCT-chapter counts
  // for the phrases actually on this chapter, rather than shipping the whole
  // book-wide index to the client. Depends on `body`, so it cannot join the load
  // above. The count itself stays book-wide (a phrase in ch3 + ch7 reports 2).
  const chapterCounts = await read.phraseChapterCounts([
    ...extractCandidatePhrases(docToParagraphs(body)).keys(),
  ]);

  // Cache rows are worth a query only when AI is on; otherwise every resolve is
  // a deterministic-only fallback and the rows would go unread.
  const aiOn = read.aiEnabled();
  const cacheByNumber = new Map<number, ChapterCheckCacheRow | null>();
  if (aiOn) {
    await Promise.all(
      bookChapters.map(async (c) => {
        cacheByNumber.set(c.number, await read.checkCache(c.id));
      }),
    );
  }
  const cacheRowFor = (n: number) => cacheByNumber.get(n) ?? null;

  // The open chapter renders no dot — the writer already sees its marks in the
  // signal rail, so a dot would be redundant. (WriteIndex's shouldShowChapterDot
  // is the second, independent guard on the render side.)
  const severityByNumber = new Map<number, ChapterSeverity>();
  for (const c of bookChapters) {
    severityByNumber.set(
      c.number,
      c.number === chapterNumber
        ? null
        : severityOf(
            resolveOne({
              body: c.body,
              db,
              resolvedMarkKeys,
              aiOn,
              cacheRow: cacheRowFor(c.number),
            }),
          ),
    );
  }

  // The open chapter, resolved with its recurrence counts. Deterministic and AI
  // marks are returned SEPARATELY because the client re-runs the deterministic
  // half on every keystroke and merges the AI half back in itself.
  const marks = checkManuscript(
    buildCheckInput({ body, db, resolvedMarkKeys, chapterCounts }),
  ).marks;
  const openCache = cacheRowFor(chapterNumber);
  const aiMarks =
    aiOn && isFresh(openCache, body, db) ? (openCache!.marks as Mark[]) : [];

  return {
    marks,
    aiMarks,
    severityByNumber,
    wiki: toCheckWiki(db),
    resolvedMarkKeys,
    chapterCounts: [...chapterCounts],
  };
}
