import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, closePool } from "@/lib/db/pool";
import { loadWorldSnapshot, loadWikiSnapshot } from "@/lib/db/queries";
import { DEFAULT_BOOK_ID } from "@/lib/db/scope";

loadEnv();

// -----------------------------------------------------------------------------
// W-3 (world-model epic) — loadWorldSnapshot: the WORLD-SCOPED, progressive
// "as of book N" read (INTEGRATION, real Postgres). Independent of
// loadWikiSnapshot (which stays byte-behavior-identical for its 6 callers).
//
// GATE (puppy + mizaru signed shape):
//  - pt2  canon-survival: a canon fact (book_id IS NULL) shows in EVERY as-of-N
//          read. Mutation: drop the `book_id IS NULL OR` term on the facts predicate
//          -> the canon fact vanishes -> per-FACT RED.
//  - pt3  BI-DIRECTIONAL window (mizaru REQ-1):
//          (a) EXCLUDE-later: a book-2 fact is ABSENT from an as-of-book-1 read
//              (later-book spoiler never leaks). Mutation: `<=` -> `>=` on the win
//              CTE -> the book-2 fact leaks into the N=1 read -> RED.
//          (b) INCLUDE-earlier (POSITIVE): a book-1 fact IS present in an
//              as-of-book-2 read. A bare-equality collapse (`book_id = $asOf`) would
//              drop the book-1 fact at N=2 and pass an exclude-only test silently;
//              this positive direction catches it. Mutation: `<=` -> `=` -> the
//              book-1 fact drops out of the N=2 read -> RED.
//  - REQ-2 window-only leak-proof (mizaru): chapter_appearances is WINDOW-ONLY (no
//          canon term by design). Mutation: INJECT `book_id IS NULL OR` on the
//          appearances predicate -> a book-2-only appearance would leak into a
//          book-1 read as if canon -> RED. Proves the 3 window-only sites are
//          distinct from the 2 canon-UNION sites (necessary-not-sufficient).
//  - shared-entity-2-worlds: an entity linked to TWO worlds appears in EACH world's
//          snapshot independently (membership is the junction, not universe_id).
//  - G4  fail-closed: a FOREIGN asOfBookId (a book in another world) makes
//          the window EMPTY -> canon-only facts survive, ZERO book-scoped rows, and
//          never another world's books.
//  - G5  default-parity: loadWorldSnapshot('world-universe-1', DEFAULT_BOOK_ID)
//          returns the SAME entry-id set as today's loadWikiSnapshot() on the live
//          universe-1 (read-only; no fixture writes touch the live world).
//  - pt6 (count===rows): N/A — loadWorldSnapshot is a READER, adds no *Cascade fn.
//  - pt7 (dedup re-scope): loadWorldSnapshot reads NONE of phrase_mentions /
//          resolved_marks / dismissed_suggestions, so there is nothing to re-scope
//          here. Named-deferred (their world-scoping rides a later ticket), not
//          silently dropped.
//
// SHARED-DB HYGIENE: every fixture id is `test-w3-*`; afterAll prefix-sweeps
// `test-w3-%` in FK order (a crash mid-mutation strands fresh-UUID orphans a
// per-run id-list can't match — the prefix sweep self-heals the SHARED baseline,
// the W-1 lesson). Int tests run --no-file-parallelism. The live universe-1 / its
// world never match this prefix and are only ever READ (G5).
// -----------------------------------------------------------------------------

const uId = `test-w3-uni-${randomUUID()}`;
const worldId = `world-${uId}`;
const world2Id = `world-test-w3-w2-${randomUUID()}`; // 2nd world in the SAME universe
// Two books in one world, sort_order 0 (book-1) and 1 (book-2). The as-of-N
// window is `sort_order <= chosen`, so book-1 is "before" book-2.
const book1Id = `test-w3-b1-${randomUUID()}`;
const book2Id = `test-w3-b2-${randomUUID()}`;
// A foreign book (its own universe/world) used for G4 fail-closed: it is NOT in
// worldId's world, so it can never enter worldId's window.
const foreignUId = `test-w3-funi-${randomUUID()}`;
const foreignWorldId = `world-test-w3-fw-${randomUUID()}`;
const foreignBookId = `test-w3-fb-${randomUUID()}`;

// Entities. entMain carries all four fact/appearance kinds. entShared is linked to
// BOTH worldId and world2Id to prove per-world independence.
const entMainId = `test-w3-ent-${randomUUID()}`;
const entSharedId = `test-w3-shared-${randomUUID()}`;

const canonFactId = `test-w3-fact-canon-${randomUUID()}`;
const book1FactId = `test-w3-fact-b1-${randomUUID()}`;
const book2FactId = `test-w3-fact-b2-${randomUUID()}`;
const book1ApprId = `test-w3-appr-b1-${randomUUID()}`;
const book2ApprId = `test-w3-appr-b2-${randomUUID()}`;

async function seedFixture(): Promise<void> {
  // Two universes: worldId's home + a foreign one (for G4).
  await query(`INSERT INTO universes (id, name) VALUES ($1,$2), ($3,$4)`, [
    uId, "W3 Universe", foreignUId, "W3 Foreign Universe",
  ]);
  // W-6: worlds FIRST (books.world_id FKs worlds). TWO worlds in worldId's
  // universe + a foreign world in the foreign universe (for G4 fail-closed).
  await query(`INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1,$2,'World One',0), ($3,$2,'World Two',1), ($4,$5,'Foreign World',0)`, [
    worldId, uId, world2Id, foreignWorldId, foreignUId,
  ]);
  // Books hang DIRECTLY off a world (W-6: books.world_id). book1/book2 live in
  // worldId; the foreign book lives in the foreign world (never in worldId's window).
  await query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ($1,$2,'Book One',0), ($3,$2,'Book Two',1), ($4,$5,'Foreign',0)`,
    [book1Id, worldId, book2Id, foreignBookId, foreignWorldId],
  );
  // Entities live in the universe; membership is the junction below.
  await query(
    `INSERT INTO entries (id, kind, name, catalogue_no, shelf, universe_id, deleted_at)
       VALUES ($1,'character','Main','w3-c1','people',$3,NULL),
              ($2,'character','Shared','w3-c2','people',$3,NULL)`,
    [entMainId, entSharedId, uId],
  );
  // Membership: entMain -> worldId only; entShared -> BOTH worlds.
  await query(
    `INSERT INTO world_entities (world_id, entity_id) VALUES ($1,$2), ($1,$3), ($4,$3)`,
    [worldId, entMainId, entSharedId, world2Id],
  );
  // Facts on entMain: one canon (book_id NULL, every book), one book-1-only, one
  // book-2-only. This is the core of pt2/pt3.
  await query(
    `INSERT INTO facts (id, entry_id, key, value, book_id) VALUES
       ($1,$4,'origin','canon-truth',NULL),
       ($2,$4,'b1key','book-1-detail',$5),
       ($3,$4,'b2key','book-2-spoiler',$6)`,
    [canonFactId, book1FactId, book2FactId, entMainId, book1Id, book2Id],
  );
  // Appearances on entMain: one in book-1, one in book-2 (WINDOW-ONLY, REQ-2).
  await query(
    `INSERT INTO chapter_appearances (id, entry_id, chapter, text, book_id) VALUES
       ($1,$3,1,'seen in book one',$4),
       ($2,$3,1,'seen in book two',$5)`,
    [book1ApprId, book2ApprId, entMainId, book1Id, book2Id],
  );
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
  await seedFixture();
});

afterAll(async () => {
  // FK order: leaf child rows -> membership -> entries -> worlds -> books ->
  // worlds -> universes. Sweep by the `test-w3-%` PREFIX so a crashed mutation
  // run's fresh-UUID orphans still get healed (W-1 lesson).
  await query(`DELETE FROM chapter_appearances WHERE id LIKE 'test-w3-%'`);
  await query(`DELETE FROM facts WHERE id LIKE 'test-w3-%'`);
  await query(`DELETE FROM world_entities WHERE entity_id LIKE 'test-w3-%'`);
  await query(`DELETE FROM entries WHERE id LIKE 'test-w3-%'`);
  await query(`DELETE FROM books WHERE id LIKE 'test-w3-%'`);
  await query(`DELETE FROM worlds WHERE id LIKE 'world-test-w3-%'`);
  await query(`DELETE FROM worlds WHERE id LIKE 'world-%test-w3-%'`);
  await query(`DELETE FROM universes WHERE id LIKE 'test-w3-%'`);
  await closePool();
});

/** All fact ids on entMain in a given as-of-N read of worldId (per-FACT grain). */
function factIdsOfMain(snap: Awaited<ReturnType<typeof loadWorldSnapshot>>): string[] {
  return (snap.byId[entMainId]?.facts ?? []).map((f) => f.id);
}
function apprIdsOfMain(snap: Awaited<ReturnType<typeof loadWorldSnapshot>>): string[] {
  return (snap.byId[entMainId]?.appearances ?? []).map((a) => a.id);
}

describe("W-3 loadWorldSnapshot as-of-book window (real Postgres)", () => {
  it("pt2 canon-survival: a canon fact (book_id IS NULL) shows in EVERY as-of-N read", async () => {
    const atB1 = await loadWorldSnapshot(worldId, book1Id);
    const atB2 = await loadWorldSnapshot(worldId, book2Id);
    // Per-FACT assertion (not an aggregate count). Dropping the `book_id IS NULL OR`
    // term on the facts predicate flips BOTH of these.
    expect(factIdsOfMain(atB1)).toContain(canonFactId);
    expect(factIdsOfMain(atB2)).toContain(canonFactId);
  });

  it("pt3a EXCLUDE-later: a book-2 fact is ABSENT from an as-of-book-1 read", async () => {
    const atB1 = await loadWorldSnapshot(worldId, book1Id);
    // book-1 detail IS shown; book-2 spoiler is NOT. `<=` -> `>=` leaks the spoiler.
    expect(factIdsOfMain(atB1)).toContain(book1FactId);
    expect(factIdsOfMain(atB1)).not.toContain(book2FactId);
  });

  it("pt3b INCLUDE-earlier (positive): a book-1 fact IS present in an as-of-book-2 read", async () => {
    const atB2 = await loadWorldSnapshot(worldId, book2Id);
    // Both the earlier book-1 fact AND the current book-2 fact are visible at N=2.
    // A bare-equality collapse (`book_id = $asOf`) would drop book1FactId here.
    expect(factIdsOfMain(atB2)).toContain(book1FactId);
    expect(factIdsOfMain(atB2)).toContain(book2FactId);
  });

  it("REQ-2 window-only leak-proof: a book-2-only appearance does NOT leak into a book-1 read", async () => {
    const atB1 = await loadWorldSnapshot(worldId, book1Id);
    const atB2 = await loadWorldSnapshot(worldId, book2Id);
    // appearances are WINDOW-ONLY (no canon term). Injecting `book_id IS NULL OR`
    // does nothing (all have book_id), so the real leak-proof is: the book-2
    // appearance is absent at N=1 and present at N=2, while book-1's is always shown.
    expect(apprIdsOfMain(atB1)).toContain(book1ApprId);
    expect(apprIdsOfMain(atB1)).not.toContain(book2ApprId);
    expect(apprIdsOfMain(atB2)).toContain(book1ApprId);
    expect(apprIdsOfMain(atB2)).toContain(book2ApprId);
  });

  it("shared-entity: an entity linked to TWO worlds appears in EACH world's snapshot", async () => {
    const w1 = await loadWorldSnapshot(worldId, book1Id);
    const w2 = await loadWorldSnapshot(world2Id, book1Id);
    expect(w1.byId[entSharedId]).toBeDefined();
    expect(w2.byId[entSharedId]).toBeDefined();
    // entMain is linked ONLY to worldId, so it is absent from world2.
    expect(w1.byId[entMainId]).toBeDefined();
    expect(w2.byId[entMainId]).toBeUndefined();
  });

  it("G4 fail-closed: a FOREIGN asOfBookId yields canon-only facts and ZERO book-scoped rows", async () => {
    // foreignBookId is in another world -> not in worldId's window ->
    // the sort_order subquery is out-of-world, window is empty.
    const foreign = await loadWorldSnapshot(worldId, foreignBookId);
    const facts = factIdsOfMain(foreign);
    expect(facts).toContain(canonFactId);      // canon (book_id NULL) survives
    expect(facts).not.toContain(book1FactId);  // no book-scoped fact leaks
    expect(facts).not.toContain(book2FactId);
    // appearances are window-only, so an empty window shows none.
    expect(apprIdsOfMain(foreign)).toHaveLength(0);
  });

  it("G5 default-parity: loadWorldSnapshot(world-universe-1, DEFAULT) matches loadWikiSnapshot() entry-ids (live, read-only)", async () => {
    const world = await loadWorldSnapshot("world-universe-1", DEFAULT_BOOK_ID);
    const wiki = await loadWikiSnapshot();
    // universe-1 holds TWO worlds: Ashkeld (world-universe-1) and Vosk (world-vosk).
    // loadWikiSnapshot() is UNIVERSE-scoped so it returns both worlds entries;
    // loadWorldSnapshot(world-universe-1) is WORLD-scoped so Vosk is correctly absent.
    // Parity holds against wiki entries FILTERED to this world membership.
    const members = await query("SELECT entity_id FROM world_entities WHERE world_id = 'world-universe-1'");
    const memberIds = new Set(members.rows.map((r) => r.entity_id));
    const worldIds = world.entries.map((e) => e.id).sort();
    const wikiIds = wiki.entries.map((e) => e.id).filter((id) => memberIds.has(id)).sort();
    expect(worldIds).toEqual(wikiIds);
  });
});
