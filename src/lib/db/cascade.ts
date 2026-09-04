// =============================================================================
// Deleting a universe / world / book — ONE plan, TWO verbs (T-DEEP-6).
//
// A structural delete is shown to the writer before it happens ("this removes N
// rows"), then performed. Those were two separate bodies of SQL — three preview
// functions counting, three mutations deleting — and the whole safety claim was
// that the counting predicates and the deleting predicates agree. Nothing
// enforced it. They had already drifted: the universe preview counted
// entry-scoped facets with `book_id IS NULL`, while the delete removed them
// regardless of book_id, so a facet scoped to a FOREIGN universe's book was
// removed but never predicted.
//
// Here a cascade is a PLAN: an ordered list of steps, each naming a table, one
// predicate, and the count bucket its rows land in. `previewCascade` runs the
// plan as COUNTs; `deleteCascade` runs the same plan as DELETEs in one
// transaction. There is one predicate per step, so preview and delete cannot
// disagree — and the ordering constraints that used to live in prose are now
// the order of the list.
//
// TWO orderings are load-bearing, and both are properties of the step list:
//
//   * BOOK-SCOPED BEFORE ENTRY-SCOPED. A book in the target can hold a
//     book-scoped facet on an entry belonging to ANOTHER universe: that facet
//     must die with the book, but the foreign entry must survive. So facets are
//     matched by book_id, entries only by universe_id. Each entry-scoped step
//     then excludes the book set the earlier step already took, so a row that is
//     both is handled — and counted — exactly once, under either verb.
//   * UNLINK BEFORE ORPHAN. A world's membership rows are unlinked first; an
//     entity still linked to a sibling world lives on, one whose LAST link was
//     here is deleted. The orphan step's predicate says "captured as linked
//     here, and no OTHER world links it" — which is true before the unlink (so
//     the count is right) and still true after it (so the delete is right). That
//     `<> $1` clause is what lets both verbs share one predicate.
//
// Every child row is removed by an EXPLICIT statement, never left to an implicit
// ON DELETE CASCADE, so `total === rows actually removed` holds by construction.
// =============================================================================

import { one, rows, withTransaction } from "./pool";

/** Per-table breakdown of a cascade, plus the summed total. */
export interface CascadeCount {
  ties: number;
  facts: number;
  entryFacets: number;
  chapterAppearances: number;
  chapters: number;
  openQuestions: number;
  entries: number;
  researchThreads: number;
  books: number;
  universes: number;
  /** Junction membership UNLINKED. The entity ROW survives unless orphaned. */
  worldEntities: number;
  /** User categories owned by the world; built-ins (world_id NULL) never count. */
  categories: number;
  worlds: number;
  total: number;
}

type CascadeBucket = Exclude<keyof CascadeCount, "total">;

interface CascadeStep {
  /** Which bucket this step's rows land in. Several steps may share one. */
  bucket: CascadeBucket;
  /** The table, optionally aliased for the predicate. */
  from: string;
  /** WHERE clause. `$1` is the target id; `$2` is the captured id list. */
  where: string;
}

interface CascadePlan {
  id: string;
  /**
   * Ids read BEFORE any step runs, bound as `$2`. For rows that can only be
   * identified against state an earlier step is about to destroy.
   */
  capture?: string;
  steps: readonly CascadeStep[];
}

/** What the writer asked to delete. */
export type CascadeTarget =
  | { kind: "universe"; id: string }
  | { kind: "world"; id: string }
  | { kind: "book"; id: string };

function emptyCascade(): CascadeCount {
  return {
    ties: 0,
    facts: 0,
    entryFacets: 0,
    chapterAppearances: 0,
    chapters: 0,
    openQuestions: 0,
    entries: 0,
    researchThreads: 0,
    books: 0,
    universes: 0,
    worldEntities: 0,
    categories: 0,
    worlds: 0,
    total: 0,
  };
}

function sumTotal(c: CascadeCount): CascadeCount {
  c.total =
    c.ties + c.facts + c.entryFacets + c.chapterAppearances + c.chapters +
    c.openQuestions + c.entries + c.researchThreads + c.books + c.universes +
    c.worldEntities + c.categories + c.worlds;
  return c;
}

// ---- The plans ------------------------------------------------------------

function planFor(target: CascadeTarget): CascadePlan {
  switch (target.kind) {
    case "universe": {
      // W-6: books hang off worlds, so the book set joins books -> worlds.
      const booksOf = `SELECT b.id FROM books b JOIN worlds w ON w.id = b.world_id WHERE w.universe_id = $1`;
      const entriesOf = `SELECT id FROM entries WHERE universe_id = $1`;
      // Rows the book-scoped steps above already took. An entry-scoped step
      // excludes them so the same row is never handled twice under COUNT, and
      // the clause is inert under DELETE (they are already gone).
      const notAlreadyTaken = `(book_id IS NULL OR book_id NOT IN (${booksOf}))`;
      return {
        id: target.id,
        steps: [
          { bucket: "ties", from: "ties", where: `book_id IN (${booksOf})` },
          { bucket: "facts", from: "facts", where: `book_id IN (${booksOf})` },
          { bucket: "entryFacets", from: "entry_facets", where: `book_id IN (${booksOf})` },
          {
            bucket: "ties",
            from: "ties",
            where: `(from_entry_id IN (${entriesOf}) OR to_entry_id IN (${entriesOf})) AND ${notAlreadyTaken}`,
          },
          { bucket: "facts", from: "facts", where: `entry_id IN (${entriesOf}) AND ${notAlreadyTaken}` },
          { bucket: "entryFacets", from: "entry_facets", where: `entry_id IN (${entriesOf}) AND ${notAlreadyTaken}` },
          { bucket: "openQuestions", from: "open_questions", where: `entry_id IN (${entriesOf})` },
          { bucket: "chapterAppearances", from: "chapter_appearances", where: `book_id IN (${booksOf})` },
          { bucket: "chapters", from: "chapters", where: `book_id IN (${booksOf})` },
          // Entries are now childless; the residual FK cascade fires on nothing.
          { bucket: "entries", from: "entries", where: `universe_id = $1` },
          { bucket: "researchThreads", from: "research_threads", where: `universe_id = $1` },
          // The skeleton, leaf -> root. Worlds are deliberately left intact: a
          // universe delete has never dropped its worlds.
          { bucket: "books", from: "books", where: `world_id IN (SELECT id FROM worlds WHERE universe_id = $1)` },
          { bucket: "universes", from: "universes", where: `id = $1` },
        ],
      };
    }

    case "book":
      // Book-scoped rows only. NULL-canon belongs to the universe and stays
      // visible in sibling books; entries are never touched.
      return {
        id: target.id,
        steps: [
          { bucket: "ties", from: "ties", where: `book_id = $1` },
          { bucket: "facts", from: "facts", where: `book_id = $1` },
          { bucket: "entryFacets", from: "entry_facets", where: `book_id = $1` },
          { bucket: "chapterAppearances", from: "chapter_appearances", where: `book_id = $1` },
          { bucket: "chapters", from: "chapters", where: `book_id = $1` },
          { bucket: "books", from: "books", where: `id = $1` },
        ],
      };

    case "world": {
      const booksOf = `SELECT id FROM books WHERE world_id = $1`;
      return {
        id: target.id,
        // The entities linked HERE, read before the unlink removes the evidence.
        capture: `SELECT entity_id AS id FROM world_entities WHERE world_id = $1`,
        steps: [
          // W-6: the world OWNS its books, so their subtree goes with it.
          // Entries and universe-canon are never touched here.
          { bucket: "ties", from: "ties", where: `book_id IN (${booksOf})` },
          { bucket: "facts", from: "facts", where: `book_id IN (${booksOf})` },
          { bucket: "entryFacets", from: "entry_facets", where: `book_id IN (${booksOf})` },
          { bucket: "chapterAppearances", from: "chapter_appearances", where: `book_id IN (${booksOf})` },
          { bucket: "chapters", from: "chapters", where: `book_id IN (${booksOf})` },
          { bucket: "books", from: "books", where: `world_id = $1` },
          // UNLINK. An entity shared into a sibling world keeps that link.
          { bucket: "worldEntities", from: "world_entities", where: `world_id = $1` },
          // ORPHAN (=DELETE-on-last-link). Their FK-cascade children go too; an
          // entity with zero world links is unreachable dead data, not a kept
          // orphan. The `<> $1` is what makes this true under BOTH verbs.
          {
            bucket: "entries",
            from: "entries e",
            where: `e.id = ANY($2)
              AND NOT EXISTS (
                SELECT 1 FROM world_entities we
                 WHERE we.entity_id = e.id AND we.world_id <> $1
              )`,
          },
          // The world's user categories. The built-ins (world_id IS NULL) are
          // global and survive, so a shared entity's kind still resolves.
          { bucket: "categories", from: "categories", where: `world_id = $1` },
          { bucket: "worlds", from: "worlds", where: `id = $1` },
        ],
      };
    }
  }
}

/** Steps that need `$2` are skipped when nothing was captured (they match none). */
function paramsFor(step: CascadeStep, id: string, captured: string[] | null): unknown[] | null {
  if (!step.where.includes("$2")) return [id];
  if (captured === null || captured.length === 0) return null;
  return [id, captured];
}

// ---- The two verbs --------------------------------------------------------

/**
 * ADVISORY count of everything `deleteCascade` would remove, for the danger
 * modal. Read-only. The authoritative number is still the delete's own summed
 * rowCounts — but it runs the SAME plan, so the two agree by construction.
 */
export async function previewCascade(target: CascadeTarget): Promise<CascadeCount> {
  const plan = planFor(target);
  const captured = plan.capture
    ? (await rows<{ id: string }>(plan.capture, [plan.id])).map((r) => r.id)
    : null;

  const count = emptyCascade();
  const counted = await Promise.all(
    plan.steps.map(async (step) => {
      const params = paramsFor(step, plan.id, captured);
      if (params === null) return 0;
      const r = await one<{ n: string }>(
        `SELECT COUNT(*) AS n FROM ${step.from} WHERE ${step.where}`,
        params,
      );
      return r ? Number(r.n) : 0;
    }),
  );
  plan.steps.forEach((step, i) => {
    count[step.bucket] += counted[i]!;
  });
  return sumTotal(count);
}

/**
 * Perform the cascade in ONE transaction: either the whole subtree goes or
 * nothing does. Returns the per-table count whose `total` is exactly the number
 * of rows removed.
 */
export async function deleteCascade(target: CascadeTarget): Promise<CascadeCount> {
  const plan = planFor(target);
  return withTransaction(async (client) => {
    const captured = plan.capture
      ? (await client.query<{ id: string }>(plan.capture, [plan.id])).rows.map((r) => r.id)
      : null;

    const count = emptyCascade();
    // Strictly in order: the plan's sequence IS the ordering contract.
    for (const step of plan.steps) {
      const params = paramsFor(step, plan.id, captured);
      if (params === null) continue;
      const res = await client.query(
        `DELETE FROM ${step.from} WHERE ${step.where}`,
        params,
      );
      count[step.bucket] += res.rowCount ?? 0;
    }
    return sumTotal(count);
  });
}
