import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { loadWikiSnapshot, getEntryWithDetails } from "@/lib/db/queries";
import {
  insertEntry,
  insertFact,
  insertTie,
  insertBook,
  upsertEntryFacet,
} from "@/lib/db/mutations";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID, DEFAULT_WORLD_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// F7-S4 — HYBRID FACET LAYER (INTEGRATION, real Postgres). The conceptual heart
// of F7: the SAME entry reads differently per book without a canon fork.
//
// LOCKED MODEL (adjudicated by chick, data-model gate):
//  - SCALARS (name/summary/note): entry_facets(entry_id, book_id, ...), REPLACE
//    per book via COALESCE(facet.col, canon.col). A book overriding a scalar
//    replaces canon FOR THAT BOOK ONLY; other books/universe canon unchanged.
//  - LISTS (facts, ties): nullable book_id. NULL = canon (shows in every book);
//    non-NULL = book-only. Book view = UNION(canon, book) = ADDITIVE, INTERLEAVED
//    by (sort_order, id) — a book-only fact sorts at its own position, NOT below
//    all canon (recorded decision: "S4 lists interleave, not canon-first").
//  - TIE target name is facet-merged: if a book renames the tie's target entry,
//    a tie pointing at it reads the book's name (internal consistency).
//
// HEADLINE — GANDALF GREY -> WHITE:
//  E1 (scalar override): read "Gandalf" in B1 => canon "Grey the Wizard"
//    (COALESCE falls through, no facet); in B2 => facet "White the Wizard".
//    SAME entry_id, two book views. Mutating the COALESCE facet-term out =>
//    B2 shows Grey => E1 RED.
//  E2 (list additive + interleave): canon facts at sort_order 0 and 20, a B2-only
//    fact at sort_order 10. B1 => [canon0, canon20]; B2 => [canon0, book10,
//    canon20] (UNION, interleaved). Dropping `book_id IS NULL` => B2 loses canon;
//    dropping `book_id = $book` => B2 loses its book-only fact (and B1 stays
//    canon-only either way). Interleave order proves it is not canon-first.
//  E3 (tie-target facet): a canon tie Frodo->Gandalf. toName in B1 => "Grey the
//    Wizard"; in B2 => "White the Wizard" (facet-merged target). B2's target
//    rename must NOT leak into B1 (ef2 is book-scoped).
//
// DEFAULT-BOOK INVARIANT: with ZERO facet rows and all canon facts book_id=NULL,
// loadWikiSnapshot(U1, book-1) is BYTE-IDENTICAL to the pre-S4 canon-only read.
// Baseline: 15 composed entries in U1 (seed.ts declares exactly 15 real entry
// rows: 5 character + 3 world + 3 organization + 4 lore; zero are soft-deleted).
// We snapshot
// BEFORE seeding, assert the baseline, and after adding B2 facets re-assert the
// B1 view of Gandalf is untouched (Grey) — the override never leaks to B1.
//
// SHARED-DB HYGIENE: ids are `test-f7s4-*`; every created row (entry_facets,
// facts, ties, entries, books) is hard-deleted in afterAll in FK order.
// universe-1 / series-1 / book-1 are never touched (B2 is a NEW test book under
// series-1; the seed entries are NEW test entries under universe-1).
// -----------------------------------------------------------------------------

loadEnv();

const confirm = confirmWikiWrite({ confirmed: true });

const gandalfId = `test-f7s4-ent-${randomUUID()}`;
const frodoId = `test-f7s4-ent-${randomUUID()}`;
const b2Id = `test-f7s4-bk-${randomUUID()}`;
const canonFact0Id = `test-f7s4-fact-${randomUUID()}`;
const canonFact20Id = `test-f7s4-fact-${randomUUID()}`;
const bookFact10Id = `test-f7s4-fact-${randomUUID()}`;
const tieId = `test-f7s4-tie-${randomUUID()}`;

const CANON_NAME = "Grey the Wizard";
const FACET_NAME = "White the Wizard";

// The canon baseline. RULING (a) STALE TEST, not a missing seed row: seed.ts
// declares EXACTLY 15 real entry-row literals under universe-1 — 5 character
// (seed.ts L57,66,75,84,93) + 3 world (L102,111,120) + 3 organization
// (L129,138,146) + 4 lore (L155,164,173,182) — none soft-deleted. It is a
// deliberate, complete set; there is NO half-defined 16th row or gap. The prior
// hardcoded 16 was calibrated against a DB that carried 1 UI-created stray
// ('New person'/'New place', now hard-deleted): 15 seed + 1 stray = 16. A clean
// seed reads 15, so the constant, not the seed, was wrong. Single source of
// truth so both invariant checks stay pinned to the seed. (NB: seed.ts L22
// `kind: Kind;` is the TS interface decl, NOT a row — do not count it.)
const SEED_CANON_COUNT = 15;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // FK order: facets/facts/ties are children of entries; books stand alone.
  await query(`DELETE FROM entry_facets WHERE entry_id = ANY($1)`, [[gandalfId, frodoId]]);
  await query(`DELETE FROM facts WHERE id = ANY($1)`, [[canonFact0Id, canonFact20Id, bookFact10Id]]);
  await query(`DELETE FROM ties WHERE id = $1`, [tieId]);
  await query(`DELETE FROM entries WHERE id = ANY($1)`, [[gandalfId, frodoId]]);
  await query(`DELETE FROM books WHERE id = $1`, [b2Id]);
  await closePool();
});

describe("F7-S4 hybrid facet layer (real Postgres)", () => {
  it("DEFAULT-BOOK INVARIANT: pre-seed, the merged B1 read is the canon-only read", async () => {
    // The default-book invariant: with all canon facts book_id=NULL and no facet
    // rows for a real entry, loadWikiSnapshot(U1, book-1) equals the pre-S4
    // canon read. We assert this two ways, BOTH immune to parallel test rows that
    // other int files transiently seed under U1 (a bare snapshot.entries.length
    // is NOT — it counts those too, so it flakes in the shared-DB full run):
    //  (a) the canon baseline itself: exactly SEED_CANON_COUNT REAL (non-test) U1 entries.
    const canon = await one<{ c: number }>(
      `SELECT COUNT(*)::int c FROM entries
        WHERE deleted_at IS NULL AND universe_id = $1 AND id NOT LIKE 'test-%'`,
      [DEFAULT_UNIVERSE_ID],
    );
    expect(canon?.c).toBe(SEED_CANON_COUNT);
    //  (b) our test entries do NOT exist yet in the merged read (clean slate).
    const snap = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID);
    expect(snap.byId[gandalfId]).toBeUndefined();
    expect(snap.byId[frodoId]).toBeUndefined();
  });

  it("E1 scalar override: Gandalf reads canon 'Grey' in B1, facet 'White' in B2", async () => {
    // Seed canon Gandalf under U1 (name = Grey). No facet in B1.
    await insertEntry(
      {
        id: gandalfId,
        kind: "character",
        name: CANON_NAME,
        catalogueNo: "test-f7s4-G",
        note: "canon note",
        summary: "A wizard of the Grey order.",
        shelf: "characters",
        sortOrder: 9000,
      },
      confirm,
    );
    // A NEW book B2 under the existing series-1 (structural, no wiki token).
    await insertBook({ id: b2Id, name: "Book Two", worldId: DEFAULT_WORLD_ID });
    // B2 overrides ONLY the name -> White. summary/note stay NULL => canon shows.
    await upsertEntryFacet({ entryId: gandalfId, bookId: b2Id, name: FACET_NAME }, confirm);

    // B1 (default book): no facet row => COALESCE falls through to canon.
    const b1 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID);
    expect(b1.byId[gandalfId]?.name).toBe(CANON_NAME);
    // B2: the facet REPLACES the name.
    const b2 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, b2Id);
    expect(b2.byId[gandalfId]?.name).toBe(FACET_NAME);
    // Same entry_id in both views (not a fork).
    expect(b2.byId[gandalfId]?.id).toBe(gandalfId);
    // summary was NOT overridden => still canon in BOTH books (partial facet).
    expect(b1.byId[gandalfId]?.summary).toBe("A wizard of the Grey order.");
    expect(b2.byId[gandalfId]?.summary).toBe("A wizard of the Grey order.");

    // getEntryWithDetails carries the same scalar merge, scoped to one entry.
    const detailB1 = await getEntryWithDetails(gandalfId, DEFAULT_BOOK_ID);
    const detailB2 = await getEntryWithDetails(gandalfId, b2Id);
    expect(detailB1?.name).toBe(CANON_NAME);
    expect(detailB2?.name).toBe(FACET_NAME);
  });

  it("E2 list additive + INTERLEAVE: B1 canon-only; B2 canon + book-fact at its sort position", async () => {
    // Canon facts on Gandalf at sort_order 0 and 20 (book_id NULL).
    await insertFact(
      { id: canonFact0Id, entryId: gandalfId, key: "canon-A", value: "born in the West", fresh: false, sortOrder: 0 },
      confirm,
    );
    await insertFact(
      { id: canonFact20Id, entryId: gandalfId, key: "canon-C", value: "bearer of Narya", fresh: false, sortOrder: 20 },
      confirm,
    );
    // A B2-ONLY fact at sort_order 10 -> lands BETWEEN the two canon facts.
    await insertFact(
      { id: bookFact10Id, entryId: gandalfId, key: "book-B", value: "falls in Moria", fresh: false, sortOrder: 10, bookId: b2Id },
      confirm,
    );

    const b1 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID);
    const b1Keys = (b1.byId[gandalfId]?.facts ?? []).map((f) => f.key);
    // B1 sees ONLY canon, in sort order. The book-only fact must NOT appear.
    expect(b1Keys).toEqual(["canon-A", "canon-C"]);

    const b2 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, b2Id);
    const b2Keys = (b2.byId[gandalfId]?.facts ?? []).map((f) => f.key);
    // B2 sees canon + its own fact, INTERLEAVED by sort_order (book-B at 10 sits
    // BETWEEN canon-A@0 and canon-C@20). This ordering is the interleave proof:
    // canon-first would give [canon-A, canon-C, book-B]; book-first would give
    // [book-B, canon-A, canon-C]. Only interleave yields the middle placement.
    expect(b2Keys).toEqual(["canon-A", "book-B", "canon-C"]);

    // getEntryWithDetails mirrors the additive/interleave merge for one entry.
    const detailB2 = await getEntryWithDetails(gandalfId, b2Id);
    expect((detailB2?.facts ?? []).map((f) => f.key)).toEqual(["canon-A", "book-B", "canon-C"]);
    const detailB1 = await getEntryWithDetails(gandalfId, DEFAULT_BOOK_ID);
    expect((detailB1?.facts ?? []).map((f) => f.key)).toEqual(["canon-A", "canon-C"]);
  });

  it("E3 tie-target facet: a canon tie to Gandalf reads 'Grey' in B1, 'White' in B2", async () => {
    // Frodo (canon) with a canon tie Frodo -> Gandalf. The tie itself is canon
    // (book_id NULL), so it shows in every book; only its DISPLAYED target name
    // is facet-merged for the active book.
    await insertEntry(
      {
        id: frodoId,
        kind: "character",
        name: "Frodo",
        catalogueNo: "test-f7s4-F",
        note: "",
        summary: "A hobbit.",
        shelf: "characters",
        sortOrder: 9001,
      },
      confirm,
    );
    await insertTie({ id: tieId, fromEntryId: frodoId, toEntryId: gandalfId, rel: "knows" }, confirm);

    const b1 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID);
    const b1Tie = (b1.byId[frodoId]?.ties ?? []).find((t) => t.id === tieId);
    expect(b1Tie?.toName).toBe(CANON_NAME); // canon target name in B1

    const b2 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, b2Id);
    const b2Tie = (b2.byId[frodoId]?.ties ?? []).find((t) => t.id === tieId);
    expect(b2Tie?.toName).toBe(FACET_NAME); // facet-merged target name in B2

    // The same canon tie is present in BOTH books (additive, book_id NULL) — the
    // rename does not remove the tie, only re-labels its target per book.
    expect(b1Tie).toBeDefined();
    expect(b2Tie).toBeDefined();
  });

  it("DEFAULT-BOOK INVARIANT holds after seeding: B1 Gandalf is untouched canon", async () => {
    // After all B2 facets exist, the B1 view of Gandalf must be byte-identical to
    // canon: the White override lives only in B2 and must never leak to B1. This
    // identity check is contention-proof (keyed on our id, not a global count).
    const b1 = await loadWikiSnapshot(DEFAULT_UNIVERSE_ID, DEFAULT_BOOK_ID);
    expect(b1.byId[gandalfId]?.name).toBe(CANON_NAME);
    expect(b1.byId[gandalfId]?.summary).toBe("A wizard of the Grey order.");
    // B1 still has exactly the two canon facts (no book-only fact leaked in).
    expect((b1.byId[gandalfId]?.facts ?? []).map((f) => f.key)).toEqual(["canon-A", "canon-C"]);
    // And the canon baseline is still exactly SEED_CANON_COUNT REAL (non-test) U1 entries:
    // our seed ADDED test entries, it did not duplicate or move any canon row.
    const canon = await one<{ c: number }>(
      `SELECT COUNT(*)::int c FROM entries
        WHERE deleted_at IS NULL AND universe_id = $1 AND id NOT LIKE 'test-%'`,
      [DEFAULT_UNIVERSE_ID],
    );
    expect(canon?.c).toBe(SEED_CANON_COUNT);
    // Our 2 test entries ARE present in the merged read (seed took effect).
    expect(b1.byId[gandalfId]).toBeDefined();
    expect(b1.byId[frodoId]).toBeDefined();
  });
});
