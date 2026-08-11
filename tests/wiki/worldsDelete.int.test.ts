import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import {
  insertEntry,
  insertFact,
  insertTie,
  insertChapter,
  insertResearchThread,
  insertUniverse,
  insertSeries,
  insertBook,
  upsertEntryFacet,
  deleteUniverseCascade,
  deleteBookCascade,
  deleteSeriesCascade,
} from "@/lib/db/mutations";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S5 — WORLD DELETE-CASCADE (INTEGRATION, real Postgres). Deleting a universe
// destroys its whole subtree; the reported cascade count MUST equal the rows
// actually removed (the danger modal must not lie), and a foreign universe's
// canon must be BYTE-IDENTICAL afterward.
//
// MECHANISM (adjudicated by chick, data-model gate): explicit-delete-all in one
// transaction — every child row is deleted by an explicit statement (never left
// to ON DELETE CASCADE), and the reported `total` is the SUM of those statements'
// rowCounts. So count === rows-removed holds BY CONSTRUCTION.
//
// FIXTURE — a THROWAWAY U2/Se2/B2 subtree plus one deliberate CROSS-UNIVERSE row:
//   * U2 has an entry (orc) with: canon fact, open question, chapter+appearance,
//     a scalar entry_facet (book_id=B2), a book-scoped fact (book_id=B2), a canon
//     tie to a second U2 entry, and a research thread.
//   * CROSS-UNIVERSE TRAP: B2 (a U2 book) also holds a book-scoped facet FACT on a
//     U1 CANON entry. Deleting U2 must remove THAT facet fact (book_id-scoped) but
//     the U1 entry — and all its OTHER-book / canon rows — must SURVIVE.
//
// GATE ASSERTIONS on deleteUniverseCascade(U2):
//   (a) reported total === (rows in DB before) - (rows after)     [count===removed]
//   (b) every U2-subtree row is gone                              [complete cascade]
//   (c) the U1 snapshot digest is byte-identical before vs after  [canon untouched]
//   (d) the U1 foreign entry survives; only its B2 facet fact was removed [trap]
//
// SHARED-DB HYGIENE: ids are `test-f7s5-*`; afterAll hard-deletes any residue in
// FK order (the happy path deletes U2 itself, but afterAll covers a failed run
// and the cross-universe U1 entry, which the U2 delete deliberately leaves).
// universe-1 / series-1 / book-1 are never structurally deleted.
// -----------------------------------------------------------------------------

loadEnv();

const confirm = confirmWikiWrite({ confirmed: true });

// U2 throwaway subtree.
const u2Id = `test-f7s5-uni-${randomUUID()}`;
const se2Id = `test-f7s5-ser-${randomUUID()}`;
const b2Id = `test-f7s5-bk-${randomUUID()}`;
const orcId = `test-f7s5-ent-${randomUUID()}`;
const trollId = `test-f7s5-ent-${randomUUID()}`;
const u2CanonFactId = `test-f7s5-fact-${randomUUID()}`;
const u2BookFactId = `test-f7s5-fact-${randomUUID()}`;
const u2TieId = `test-f7s5-tie-${randomUUID()}`;
const u2ChapterId = `test-f7s5-chap-${randomUUID()}`;
const u2ApprId = `test-f7s5-appr-${randomUUID()}`;
const u2OpenQId = `test-f7s5-oq-${randomUUID()}`;
const u2ThreadId = `test-f7s5-thr-${randomUUID()}`;

// CROSS-UNIVERSE: a U1 canon entry, plus a B2-scoped facet fact ON it.
const u1ForeignEntryId = `test-f7s5-ent-${randomUUID()}`;
const u1ForeignCanonFactId = `test-f7s5-fact-${randomUUID()}`;
const crossFacetFactId = `test-f7s5-fact-${randomUUID()}`;

// Count every world-scoped table so we can prove total === before - after.
// TCK-012: windowed to THIS test's EXACT fixture ids (passed per-call), not a
// whole-table COUNT(*). A global COUNT(*) is fragile — ANY concurrent writer
// (another suite, a stray psql, a live /wiki save) perturbs the global sum between
// the before/after snapshots and breaks count===rows even when the cascade counted
// correctly. Exact-id windowing (`id = ANY($ids)`) is immune to unrelated rows AND
// to a stray row that merely shares the `test-f7s5-` prefix (a peer fixture or a
// crashed-run orphan), which a LIKE-prefix window would still miscount. The
// count===rows invariant is unchanged, only its window narrows. entry_facets has
// no `id` column (PK = entry_id, book_id), so it is windowed by `entry_id`; every
// facet in these tests hangs off a fixture entry, so the same id array covers it.
const COUNT_ALL = `SELECT
    (SELECT COUNT(*) FROM universes WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM series WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM books WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM entries WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM facts WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM ties WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM entry_facets WHERE entry_id = ANY($1)) +
    (SELECT COUNT(*) FROM chapter_appearances WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM chapters WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM open_questions WHERE id = ANY($1)) +
    (SELECT COUNT(*) FROM research_threads WHERE id = ANY($1)) AS n`;

// Sum of world-scoped rows whose id (entry_id for entry_facets) is in `ids` — the
// caller's own fixture ids. Windowing here is what makes count===rows immune to
// concurrent writers (see COUNT_ALL comment).
async function totalRows(ids: string[]): Promise<number> {
  const r = await one<{ n: string }>(COUNT_ALL, [ids]);
  return Number(r!.n);
}

// A stable digest of the U1 canon read: entry ids+names+summaries and canon
// facts/ties, ordered, so a single string comparison catches ANY drift.
async function u1Digest(): Promise<string> {
  const entries = await query<{ id: string; name: string; summary: string }>(
    `SELECT id, name, summary FROM entries
      WHERE universe_id = $1 AND deleted_at IS NULL AND id NOT LIKE 'test-f7s5-%'
      ORDER BY id`,
    [DEFAULT_UNIVERSE_ID],
  );
  const facts = await query<{ id: string; entry_id: string; key: string; value: string }>(
    `SELECT id, entry_id, key, value FROM facts
      WHERE book_id IS NULL AND id NOT LIKE 'test-f7s5-%'
      ORDER BY id`,
  );
  const ties = await query<{ id: string; from_entry_id: string; to_entry_id: string; rel: string }>(
    `SELECT id, from_entry_id, to_entry_id, rel FROM ties
      WHERE book_id IS NULL AND id NOT LIKE 'test-f7s5-%'
      ORDER BY id`,
  );
  return JSON.stringify({ entries: entries.rows, facts: facts.rows, ties: ties.rows });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // Residue cleanup in FK order (happy path already deleted U2; this covers a
  // failed run AND the cross-universe U1 entry the U2 delete leaves behind).
  await query(`DELETE FROM ties WHERE id = ANY($1)`, [[u2TieId]]);
  await query(
    `DELETE FROM facts WHERE id = ANY($1)`,
    [[u2CanonFactId, u2BookFactId, u1ForeignCanonFactId, crossFacetFactId]],
  );
  await query(`DELETE FROM entry_facets WHERE entry_id = ANY($1)`, [[orcId, trollId, u1ForeignEntryId]]);
  await query(`DELETE FROM chapter_appearances WHERE id = ANY($1)`, [[u2ApprId]]);
  await query(`DELETE FROM open_questions WHERE id = ANY($1)`, [[u2OpenQId]]);
  await query(`DELETE FROM chapters WHERE id = ANY($1)`, [[u2ChapterId]]);
  await query(`DELETE FROM research_threads WHERE id = ANY($1)`, [[u2ThreadId]]);
  await query(`DELETE FROM entries WHERE id = ANY($1)`, [[orcId, trollId, u1ForeignEntryId]]);
  await query(`DELETE FROM books WHERE id = ANY($1)`, [[b2Id]]);
  await query(`DELETE FROM series WHERE id = ANY($1)`, [[se2Id]]);
  await query(`DELETE FROM universes WHERE id = ANY($1)`, [[u2Id]]);
  await closePool();
});

describe("F7-S5 world delete-cascade (real Postgres)", () => {
  it("deleteUniverseCascade: count === rows removed, subtree gone, U1 canon untouched, cross-universe entry survives", async () => {
    // --- Seed the U2 subtree ---------------------------------------------------
    await insertUniverse({ id: u2Id, name: "Second World" });
    await insertSeries({ id: se2Id, name: "Second Series", universeId: u2Id, sortOrder: 0 });
    await insertBook({ id: b2Id, name: "Second Book", seriesId: se2Id, sortOrder: 0 });

    await insertEntry(
      { id: orcId, kind: "character", name: "Orc", catalogueNo: "S5-1", note: "", summary: "A U2 orc.", shelf: "characters", sortOrder: 0, universeId: u2Id },
      confirm,
    );
    await insertEntry(
      { id: trollId, kind: "character", name: "Troll", catalogueNo: "S5-2", note: "", summary: "A U2 troll.", shelf: "characters", sortOrder: 1, universeId: u2Id },
      confirm,
    );
    // canon fact (book_id NULL), book-scoped fact (book_id B2), canon tie.
    await insertFact({ id: u2CanonFactId, entryId: orcId, key: "origin", value: "the pit", fresh: false, sortOrder: 0 }, confirm);
    await insertFact({ id: u2BookFactId, entryId: orcId, key: "mood", value: "book-only rage", fresh: false, sortOrder: 1, bookId: b2Id }, confirm);
    await insertTie({ id: u2TieId, fromEntryId: orcId, toEntryId: trollId, rel: "allied with" }, confirm);
    // scalar entry_facet on orc in B2.
    await upsertEntryFacet({ entryId: orcId, bookId: b2Id, name: "Orc the Renamed" }, confirm);
    // chapter + appearance + open question + research thread.
    await insertChapter({ id: u2ChapterId, number: 1, title: "U2 Ch1", body: { type: "doc" }, bookId: b2Id });
    await query(
      `INSERT INTO chapter_appearances (id, entry_id, chapter, text, book_id) VALUES ($1, $2, $3, $4, $5)`,
      [u2ApprId, orcId, 1, "The orc appears.", b2Id],
    );
    await query(
      `INSERT INTO open_questions (id, entry_id, text, sort_order) VALUES ($1, $2, $3, $4)`,
      [u2OpenQId, orcId, "Where did the orc come from?", 0],
    );
    await insertResearchThread({ id: u2ThreadId, title: "U2 thread", subtitle: "", sortOrder: 0, scope: "chat", universeId: u2Id });

    // --- CROSS-UNIVERSE trap: a U1 canon entry + a B2-scoped facet fact on it ---
    await insertEntry(
      { id: u1ForeignEntryId, kind: "character", name: "U1 Native", catalogueNo: "S5-X", note: "", summary: "Lives in U1.", shelf: "characters", sortOrder: 0, universeId: DEFAULT_UNIVERSE_ID },
      confirm,
    );
    await insertFact({ id: u1ForeignCanonFactId, entryId: u1ForeignEntryId, key: "home", value: "U1 canon", fresh: false, sortOrder: 0 }, confirm);
    // The trap row: book-scoped (book_id = B2, a U2 book) facet fact on a U1 entry.
    await insertFact({ id: crossFacetFactId, entryId: u1ForeignEntryId, key: "cameo", value: "seen in U2's book", fresh: false, sortOrder: 1, bookId: b2Id }, confirm);

    // --- Capture invariants BEFORE the delete ---------------------------------
    // This test's OWN fixture ids — the window count===rows is measured over.
    const fixtureIds = [
      u2Id, se2Id, b2Id, orcId, trollId,
      u2CanonFactId, u2BookFactId, u2TieId, u2ChapterId, u2ApprId, u2OpenQId, u2ThreadId,
      u1ForeignEntryId, u1ForeignCanonFactId, crossFacetFactId,
    ];
    const digestBefore = await u1Digest();
    const totalBefore = await totalRows(fixtureIds);

    // MUTATION-PROOF 1 (concurrent-writer immunity): a non-prefixed unrelated row
    // lands between the before/after snapshots. With the fixture-id-windowed
    // COUNT_ALL it MUST NOT affect count===rows; with the old global COUNT(*) it
    // would. It is not in `fixtureIds`, so it is invisible to the count.
    const concurrentId = `zz-concurrent-${randomUUID()}`;
    await query(`INSERT INTO universes (id, name) VALUES ($1, $2)`, [concurrentId, "Concurrent Writer"]);

    // --- ACT ------------------------------------------------------------------
    const count = await deleteUniverseCascade(u2Id);

    const totalAfter = await totalRows(fixtureIds);

    await query(`DELETE FROM universes WHERE id = $1`, [concurrentId]);

    // (a) count === rows actually removed. The reported total is the summed
    //     rowCounts; it must equal the real drop in total table rows.
    expect(count.total).toBe(totalBefore - totalAfter);

    // Sanity on the breakdown: the subtree we seeded is fully represented.
    expect(count.universes).toBe(1);
    expect(count.series).toBe(1);
    expect(count.books).toBe(1);
    expect(count.entries).toBe(2); // orc + troll (NOT the U1 foreign entry)
    expect(count.chapters).toBe(1);
    expect(count.chapterAppearances).toBe(1);
    expect(count.openQuestions).toBe(1);
    expect(count.researchThreads).toBe(1);
    expect(count.ties).toBe(1);
    // facts removed: u2 canon + u2 book-only + the cross-universe B2 facet fact = 3
    expect(count.facts).toBe(3);
    // entry_facets removed: orc's B2 scalar override = 1
    expect(count.entryFacets).toBe(1);

    // (b) every U2-subtree row is gone.
    expect(await one(`SELECT id FROM universes WHERE id = $1`, [u2Id])).toBeNull();
    expect(await one(`SELECT id FROM series WHERE id = $1`, [se2Id])).toBeNull();
    expect(await one(`SELECT id FROM books WHERE id = $1`, [b2Id])).toBeNull();
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [orcId])).toBeNull();
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [trollId])).toBeNull();
    expect(await one(`SELECT id FROM facts WHERE id = $1`, [u2CanonFactId])).toBeNull();
    expect(await one(`SELECT id FROM facts WHERE id = $1`, [u2BookFactId])).toBeNull();
    expect(await one(`SELECT id FROM ties WHERE id = $1`, [u2TieId])).toBeNull();
    expect(await one(`SELECT id FROM chapters WHERE id = $1`, [u2ChapterId])).toBeNull();
    expect(await one(`SELECT id FROM chapter_appearances WHERE id = $1`, [u2ApprId])).toBeNull();
    expect(await one(`SELECT id FROM open_questions WHERE id = $1`, [u2OpenQId])).toBeNull();
    expect(await one(`SELECT id FROM research_threads WHERE id = $1`, [u2ThreadId])).toBeNull();

    // (c) U1 canon read is BYTE-IDENTICAL before vs after (no leak).
    const digestAfter = await u1Digest();
    expect(digestAfter).toBe(digestBefore);

    // (d) CROSS-UNIVERSE trap: the U1 foreign entry SURVIVES with its canon fact;
    //     ONLY its B2-scoped facet fact was removed.
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [u1ForeignEntryId])).not.toBeNull();
    expect(await one(`SELECT id FROM facts WHERE id = $1`, [u1ForeignCanonFactId])).not.toBeNull();
    expect(await one(`SELECT id FROM facts WHERE id = $1`, [crossFacetFactId])).toBeNull();
  });

  it("deleteBookCascade: removes only the target book's book-scoped rows; canon and sibling book survive", async () => {
    // Two books under ONE series under a fresh universe; a canon fact (book_id
    // NULL) plus a book-scoped fact in EACH book, on a shared entry.
    const uId = `test-f7s5-uni-${randomUUID()}`;
    const sId = `test-f7s5-ser-${randomUUID()}`;
    const bTargetId = `test-f7s5-bk-${randomUUID()}`;
    const bSiblingId = `test-f7s5-bk-${randomUUID()}`;
    const entId = `test-f7s5-ent-${randomUUID()}`;
    const canonFactId = `test-f7s5-fact-${randomUUID()}`;
    const targetFactId = `test-f7s5-fact-${randomUUID()}`;
    const siblingFactId = `test-f7s5-fact-${randomUUID()}`;
    const targetChapId = `test-f7s5-chap-${randomUUID()}`;
    try {
      await insertUniverse({ id: uId, name: "BookDel World" });
      await insertSeries({ id: sId, name: "BookDel Series", universeId: uId, sortOrder: 0 });
      await insertBook({ id: bTargetId, name: "Target Book", seriesId: sId, sortOrder: 0 });
      await insertBook({ id: bSiblingId, name: "Sibling Book", seriesId: sId, sortOrder: 1 });
      await insertEntry(
        { id: entId, kind: "character", name: "Shared", catalogueNo: "S5-B", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: uId },
        confirm,
      );
      await insertFact({ id: canonFactId, entryId: entId, key: "k", value: "canon", fresh: false, sortOrder: 0 }, confirm);
      await insertFact({ id: targetFactId, entryId: entId, key: "k", value: "target-only", fresh: false, sortOrder: 1, bookId: bTargetId }, confirm);
      await insertFact({ id: siblingFactId, entryId: entId, key: "k", value: "sibling-only", fresh: false, sortOrder: 1, bookId: bSiblingId }, confirm);
      await insertChapter({ id: targetChapId, number: 1, title: "T Ch1", body: { type: "doc" }, bookId: bTargetId });

      const bookFixtureIds = [uId, sId, bTargetId, bSiblingId, entId, canonFactId, targetFactId, siblingFactId, targetChapId];
      const totalBefore = await totalRows(bookFixtureIds);
      const count = await deleteBookCascade(bTargetId);
      const totalAfter = await totalRows(bookFixtureIds);

      // count === removed; the breakdown removes the book, its book-scoped fact,
      // its chapter — and NOTHING else.
      expect(count.total).toBe(totalBefore - totalAfter);
      expect(count.books).toBe(1);
      expect(count.facts).toBe(1); // only the target book-scoped fact
      expect(count.chapters).toBe(1);
      expect(count.entries).toBe(0); // deleteBookCascade never touches entries

      // Target book gone; its book-scoped fact gone.
      expect(await one(`SELECT id FROM books WHERE id = $1`, [bTargetId])).toBeNull();
      expect(await one(`SELECT id FROM facts WHERE id = $1`, [targetFactId])).toBeNull();
      // CANON fact survives (book_id NULL is universe canon, not book content).
      expect(await one(`SELECT id FROM facts WHERE id = $1`, [canonFactId])).not.toBeNull();
      // SIBLING book and ITS book-scoped fact survive untouched.
      expect(await one(`SELECT id FROM books WHERE id = $1`, [bSiblingId])).not.toBeNull();
      expect(await one(`SELECT id FROM facts WHERE id = $1`, [siblingFactId])).not.toBeNull();
      // The shared entry survives.
      expect(await one(`SELECT id FROM entries WHERE id = $1`, [entId])).not.toBeNull();
    } finally {
      await query(`DELETE FROM facts WHERE id = ANY($1)`, [[canonFactId, targetFactId, siblingFactId]]);
      await query(`DELETE FROM chapters WHERE id = ANY($1)`, [[targetChapId]]);
      await query(`DELETE FROM entries WHERE id = ANY($1)`, [[entId]]);
      await query(`DELETE FROM books WHERE id = ANY($1)`, [[bTargetId, bSiblingId]]);
      await query(`DELETE FROM series WHERE id = ANY($1)`, [[sId]]);
      await query(`DELETE FROM universes WHERE id = ANY($1)`, [[uId]]);
    }
  });

  it("deleteSeriesCascade: removes the series' books subtree; entries, canon, and universe survive", async () => {
    const uId = `test-f7s5-uni-${randomUUID()}`;
    const sTargetId = `test-f7s5-ser-${randomUUID()}`;
    const bId = `test-f7s5-bk-${randomUUID()}`;
    const entId = `test-f7s5-ent-${randomUUID()}`;
    const canonFactId = `test-f7s5-fact-${randomUUID()}`;
    const bookFactId = `test-f7s5-fact-${randomUUID()}`;
    const chapId = `test-f7s5-chap-${randomUUID()}`;
    try {
      await insertUniverse({ id: uId, name: "SeriesDel World" });
      await insertSeries({ id: sTargetId, name: "Target Series", universeId: uId, sortOrder: 0 });
      await insertBook({ id: bId, name: "Series Book", seriesId: sTargetId, sortOrder: 0 });
      await insertEntry(
        { id: entId, kind: "character", name: "Kept", catalogueNo: "S5-S", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: uId },
        confirm,
      );
      await insertFact({ id: canonFactId, entryId: entId, key: "k", value: "canon", fresh: false, sortOrder: 0 }, confirm);
      await insertFact({ id: bookFactId, entryId: entId, key: "k", value: "book-only", fresh: false, sortOrder: 1, bookId: bId }, confirm);
      await insertChapter({ id: chapId, number: 1, title: "S Ch1", body: { type: "doc" }, bookId: bId });

      const seriesFixtureIds = [uId, sTargetId, bId, entId, canonFactId, bookFactId, chapId];
      const totalBefore = await totalRows(seriesFixtureIds);
      const count = await deleteSeriesCascade(sTargetId);
      const totalAfter = await totalRows(seriesFixtureIds);

      expect(count.total).toBe(totalBefore - totalAfter);
      expect(count.series).toBe(1);
      expect(count.books).toBe(1);
      expect(count.facts).toBe(1); // only the book-scoped fact
      expect(count.chapters).toBe(1);

      // Series + its book + book-scoped fact gone.
      expect(await one(`SELECT id FROM series WHERE id = $1`, [sTargetId])).toBeNull();
      expect(await one(`SELECT id FROM books WHERE id = $1`, [bId])).toBeNull();
      expect(await one(`SELECT id FROM facts WHERE id = $1`, [bookFactId])).toBeNull();
      // Entry, its canon fact, and the universe survive (series delete is subtree-only).
      expect(await one(`SELECT id FROM entries WHERE id = $1`, [entId])).not.toBeNull();
      expect(await one(`SELECT id FROM facts WHERE id = $1`, [canonFactId])).not.toBeNull();
      expect(await one(`SELECT id FROM universes WHERE id = $1`, [uId])).not.toBeNull();
    } finally {
      await query(`DELETE FROM facts WHERE id = ANY($1)`, [[canonFactId, bookFactId]]);
      await query(`DELETE FROM chapters WHERE id = ANY($1)`, [[chapId]]);
      await query(`DELETE FROM entries WHERE id = ANY($1)`, [[entId]]);
      await query(`DELETE FROM books WHERE id = ANY($1)`, [[bId]]);
      await query(`DELETE FROM series WHERE id = ANY($1)`, [[sTargetId]]);
      await query(`DELETE FROM universes WHERE id = ANY($1)`, [[uId]]);
    }
  });
});
