// Hand-written, typed, parameterized queries. Always $1/$2 placeholders, never
// string interpolation of values. Column aliases map snake_case -> camelCase so
// row shapes match domain/types.ts.
import { rows, one } from "./pool";
import type {
  EntryRow,
  FactRow,
  ChapterAppearanceRow,
  OpenQuestionRow,
  ResolvedTie,
  EntryWithDetails,
  WikiSnapshot,
  ChapterRow,
  ResearchTurnRow,
  PropositionRow,
  KeptCardRow,
  ResearchTurnWithCards,
  ResearchProposition,
} from "../domain/types";

// ---- Column selection fragments ------------------------------------------

const ENTRY_COLS = `
  id,
  kind,
  name,
  catalogue_no AS "catalogueNo",
  note,
  summary,
  shelf,
  sort_order AS "sortOrder"
`;

const FACT_COLS = `
  id,
  entry_id AS "entryId",
  key,
  value,
  fresh,
  sort_order AS "sortOrder"
`;

const APPEARANCE_COLS = `
  id,
  entry_id AS "entryId",
  chapter,
  text,
  flag,
  flag_text AS "flagText",
  sort_order AS "sortOrder"
`;

const OPEN_QUESTION_COLS = `
  id,
  entry_id AS "entryId",
  text,
  sort_order AS "sortOrder"
`;

// ---- Entry reads ----------------------------------------------------------

export async function getAllEntries(): Promise<EntryRow[]> {
  return rows<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries ORDER BY shelf, sort_order, name`,
  );
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  return one<EntryRow>(
    `SELECT ${ENTRY_COLS} FROM entries WHERE id = $1`,
    [id],
  );
}

export async function getFactsForEntry(entryId: string): Promise<FactRow[]> {
  return rows<FactRow>(
    `SELECT ${FACT_COLS} FROM facts WHERE entry_id = $1 ORDER BY sort_order, id`,
    [entryId],
  );
}

export async function getAppearancesForEntry(
  entryId: string,
): Promise<ChapterAppearanceRow[]> {
  return rows<ChapterAppearanceRow>(
    `SELECT ${APPEARANCE_COLS} FROM chapter_appearances
     WHERE entry_id = $1 ORDER BY chapter, sort_order, id`,
    [entryId],
  );
}

export async function getOpenQuestionsForEntry(
  entryId: string,
): Promise<OpenQuestionRow[]> {
  return rows<OpenQuestionRow>(
    `SELECT ${OPEN_QUESTION_COLS} FROM open_questions
     WHERE entry_id = $1 ORDER BY sort_order, id`,
    [entryId],
  );
}

/** Ties out of an entry, joined to the target entry's display fields. */
export async function getTiesForEntry(entryId: string): Promise<ResolvedTie[]> {
  return rows<ResolvedTie>(
    `SELECT
       t.id,
       t.from_entry_id AS "fromEntryId",
       t.to_entry_id   AS "toEntryId",
       t.rel,
       e.name          AS "toName",
       e.kind          AS "toKind",
       e.catalogue_no  AS "toCatalogueNo"
     FROM ties t
     JOIN entries e ON e.id = t.to_entry_id
     WHERE t.from_entry_id = $1
     ORDER BY t.id`,
    [entryId],
  );
}

// ---- Composed reads -------------------------------------------------------

/**
 * Load the full wiki snapshot the check engine and Wiki screen consume.
 * Single set of batched reads, composed in memory (small dataset: 15 entries).
 */
export async function loadWikiSnapshot(): Promise<WikiSnapshot> {
  const [entries, facts, appearances, openQuestions, ties] = await Promise.all([
    getAllEntries(),
    rows<FactRow>(`SELECT ${FACT_COLS} FROM facts ORDER BY sort_order, id`),
    rows<ChapterAppearanceRow>(
      `SELECT ${APPEARANCE_COLS} FROM chapter_appearances ORDER BY chapter, sort_order, id`,
    ),
    rows<OpenQuestionRow>(
      `SELECT ${OPEN_QUESTION_COLS} FROM open_questions ORDER BY sort_order, id`,
    ),
    rows<ResolvedTie>(
      `SELECT
         t.id,
         t.from_entry_id AS "fromEntryId",
         t.to_entry_id   AS "toEntryId",
         t.rel,
         e.name          AS "toName",
         e.kind          AS "toKind",
         e.catalogue_no  AS "toCatalogueNo"
       FROM ties t
       JOIN entries e ON e.id = t.to_entry_id
       ORDER BY t.id`,
    ),
  ]);

  const byId: Record<string, EntryWithDetails> = {};
  for (const entry of entries) {
    byId[entry.id] = {
      ...entry,
      facts: [],
      ties: [],
      appearances: [],
      openQuestions: [],
    };
  }

  for (const f of facts) byId[f.entryId]?.facts.push(f);
  for (const a of appearances) byId[a.entryId]?.appearances.push(a);
  for (const q of openQuestions) byId[q.entryId]?.openQuestions.push(q);
  for (const t of ties) byId[t.fromEntryId]?.ties.push(t);

  const composed = entries.map((e) => byId[e.id]!);
  return { entries: composed, byId };
}

/** A single entry with all its details (Wiki detail view). */
export async function getEntryWithDetails(
  id: string,
): Promise<EntryWithDetails | null> {
  const entry = await getEntry(id);
  if (!entry) return null;
  const [facts, ties, appearances, openQuestions] = await Promise.all([
    getFactsForEntry(id),
    getTiesForEntry(id),
    getAppearancesForEntry(id),
    getOpenQuestionsForEntry(id),
  ]);
  return { ...entry, facts, ties, appearances, openQuestions };
}

// ---- Write screen ---------------------------------------------------------

export async function getChapter(number: number): Promise<ChapterRow | null> {
  return one<ChapterRow>(
    `SELECT id, number, title, body FROM chapters WHERE number = $1`,
    [number],
  );
}

// ---- Chapters (list) ------------------------------------------------------
// Append-only section (Track C). Does NOT modify existing functions.

/**
 * List every chapter as {id, number, title}, ordered by number. Deliberately
 * omits the (large) body so the Write left index stays light — the selected
 * chapter's body is loaded separately via getChapter(number).
 */
export async function listChapters(): Promise<
  { id: string; number: number; title: string }[]
> {
  return rows<{ id: string; number: number; title: string }>(
    `SELECT id, number, title FROM chapters ORDER BY number`,
  );
}

export async function getResolvedMarkKeys(): Promise<string[]> {
  const res = await rows<{ markKey: string }>(
    `SELECT mark_key AS "markKey" FROM resolved_marks`,
  );
  return res.map((r) => r.markKey);
}

export async function getDismissedSuggestionKeys(): Promise<string[]> {
  const res = await rows<{ suggestionKey: string }>(
    `SELECT suggestion_key AS "suggestionKey" FROM dismissed_suggestions`,
  );
  return res.map((r) => r.suggestionKey);
}

/**
 * Book-wide cross-chapter recurrence index (Tier 2), SCOPED to the phrases the
 * caller actually needs. For each requested phrase, how many DISTINCT chapters
 * it appears in BOOK-WIDE. The engine ranks an unrecorded mark 'high' when its
 * phrase recurs across >= 2 chapters (rank, never gate). Keys are the canonical
 * phraseIndexKey form stored by extractCandidatePhrases (lowercased +
 * apostrophe-folded), so the engine's phraseIndexKey lookup matches. Returns a
 * Map for O(1) lookup in checkManuscript.
 *
 * `phrases` narrows WHICH rows are fetched (the write page only ever looks up
 * the phrases on the CURRENT chapter, so we no longer serialize the entire
 * book-wide index to the client every load). It does NOT narrow the recurrence
 * count: COUNT(DISTINCT chapter_number) is still evaluated over ALL of a
 * phrase's rows, so a phrase in ch3 + ch7 still returns 2 even when the lookup
 * is issued from ch3. Scoping the WHERE must never shrink the DISTINCT-chapter
 * aggregate — that is the whole correctness contract of this function. An empty
 * `phrases` array returns an empty Map (nothing to rank).
 */
export async function getPhraseChapterCounts(
  phrases: readonly string[],
): Promise<Map<string, number>> {
  if (phrases.length === 0) return new Map();
  const res = await rows<{ phrase: string; chapters: number }>(
    `SELECT phrase, COUNT(DISTINCT chapter_number)::int AS chapters
       FROM phrase_mentions
      WHERE phrase = ANY($1)
      GROUP BY phrase`,
    [phrases as string[]],
  );
  return new Map(res.map((r) => [r.phrase, r.chapters]));
}

// ---- Research screen ------------------------------------------------------

export async function getResearchThread(
  threadId: string,
): Promise<ResearchTurnWithCards[]> {
  const [turns, props, kept] = await Promise.all([
    rows<ResearchTurnRow>(
      `SELECT id, thread_id AS "threadId", ordinal, side, who, text
       FROM research_turns WHERE thread_id = $1 ORDER BY ordinal`,
      [threadId],
    ),
    rows<PropositionRow>(
      `SELECT p.id, p.turn_id AS "turnId", p.kind, p.title, p.body,
              p.as_kind AS "asKind", p.sort_order AS "sortOrder"
       FROM propositions p
       JOIN research_turns t ON t.id = p.turn_id
       WHERE t.thread_id = $1
       ORDER BY p.sort_order, p.id`,
      [threadId],
    ),
    rows<KeptCardRow>(
      `SELECT proposition_id AS "propositionId", kept_at AS "keptAt", in_wiki AS "inWiki"
       FROM kept_cards`,
    ),
  ]);

  const keptById = new Map(kept.map((k) => [k.propositionId, k]));
  const cardsByTurn = new Map<string, ResearchProposition[]>();
  for (const p of props) {
    const k = keptById.get(p.id);
    const card: ResearchProposition = {
      ...p,
      kept: Boolean(k),
      inWiki: k?.inWiki ?? false,
    };
    const list = cardsByTurn.get(p.turnId) ?? [];
    list.push(card);
    cardsByTurn.set(p.turnId, list);
  }

  return turns.map((t) => ({ ...t, cards: cardsByTurn.get(t.id) ?? [] }));
}

// ---- Research threads (Track B — multi-thread sidebar) --------------------
// APPEND-ONLY: read for the Gemini-style thread list on the Research screen.
// Ordered by sort_order (the seeded thread order). Read-only; no existing
// query above is modified.

/**
 * List every research thread for the LEFT sidebar, in sort_order (then id as a
 * stable tiebreaker so newly-created threads sharing a sort_order are ordered
 * deterministically). Column aliases map snake_case -> camelCase.
 */
export async function listResearchThreads(): Promise<
  import("../domain/types").ResearchThreadRow[]
> {
  return rows<import("../domain/types").ResearchThreadRow>(
    `SELECT id, title, subtitle, sort_order AS "sortOrder"
     FROM research_threads
     ORDER BY sort_order, id`,
  );
}
