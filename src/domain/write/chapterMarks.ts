import { checkManuscript, type Mark } from "@/domain/check";
import type { CheckWiki } from "@/domain/check";
import { mergeMarks } from "@/domain/check/ai";
import { hashValue } from "@/domain/check/hash";
import type { ChapterSeverity } from "@/domain/check/severity";
import { extractCandidatePhrases } from "@/domain/check/unrecorded";
import type { ChapterCheckCacheRow, WikiSnapshot as DbWiki } from "@/domain/types";
import { buildCheckInput, docToParagraphs, toCheckWiki } from "./adapters";

export interface ChapterBody {
  id: string;
  number: number;
  body: unknown;
}

export interface ChapterMarksReader {
  wikiSnapshot(universeId: string): Promise<DbWiki>;
  resolvedMarkKeys(bookId: string): Promise<string[]>;
  bookChapters(bookId: string): Promise<ChapterBody[]>;
  phraseChapterCounts(bookId: string, phrases: string[]): Promise<ReadonlyMap<string, number>>;
  checkCache(chapterId: string): Promise<ChapterCheckCacheRow | null>;
  aiEnabled(): boolean;
}

export interface ChapterMarksArgs {
  universeId: string;
  bookId: string;
  chapterNumber: number;
  body: unknown;
}

export interface ChapterMarks {
  marks: Mark[];
  aiMarks: Mark[];
  severityByNumber: Map<number, ChapterSeverity>;
  wiki: CheckWiki;
  resolvedMarkKeys: string[];
  chapterCounts: [string, number][];
}

// The only freshness gate. It uses the same hashValue over the same inputs that
// server/actions/write/ai.ts stamps the cache row with, so the two cannot drift.
function isFresh(row: ChapterCheckCacheRow | null, body: unknown, db: DbWiki): boolean {
  return (
    row !== null && row.bodyHash === hashValue(body) && row.wikiHash === hashValue(db)
  );
}

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
  // Merge, not replace: the cached row holds AI-only marks.
  return mergeMarks(deterministic, args.cacheRow!.marks as Mark[]);
}

function severityOf(marks: Mark[]): ChapterSeverity {
  if (marks.some((m) => m.kind === "conflict")) return "red";
  if (marks.some((m) => m.kind === "missing")) return "yellow";
  return null;
}

export async function loadChapterMarks(
  args: ChapterMarksArgs,
  read: ChapterMarksReader,
): Promise<ChapterMarks> {
  const { universeId, bookId, chapterNumber, body } = args;

  const [db, resolvedMarkKeys, bookChapters] = await Promise.all([
    read.wikiSnapshot(universeId),
    read.resolvedMarkKeys(bookId),
    read.bookChapters(bookId),
  ]);

  const chapterCounts = await read.phraseChapterCounts(bookId, [
    ...extractCandidatePhrases(docToParagraphs(body)).keys(),
  ]);

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

  // The open chapter gets no dot: its marks are already in the rail.
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

  // Returned separately: the client re-runs the deterministic half on every
  // keystroke and merges the AI half back in itself.
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
