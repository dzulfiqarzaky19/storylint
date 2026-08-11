import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { insertEntry, deleteWorldCascade } from "@/lib/db/mutations";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// W-2 — deleteWorldCascade (INTEGRATION, real Postgres). Deleting a WORLD unlinks
// its shared entities (junction only — the entity ROWS survive, reclaimable) and
// drops its user categories, but NEVER destroys entities, universe-canon, sibling
// worlds, or the 4 GLOBAL built-in categories. Books are universe-owned, not
// world-owned, so a world delete removes NO books (coordinator ruling A).
//
// Explicit COUNTED deletes in one txn, so the reported `total` === rows actually
// removed BY CONSTRUCTION.
//
// FIXTURE — TWO sibling worlds (A, B) under the SAME universe (universe-1), a
// SHARED entity linked to BOTH, plus a per-world user category on A:
//   * worldA, worldB : both point at DEFAULT_UNIVERSE_ID.
//   * shared entity  : a real entries row, linked via world_entities to A AND B.
//   * a-only entity  : linked to A only (its membership dies with A; the row lives).
//   * userCatA       : a categories row with world_id = A (user category).
//   * the 4 built-ins (world_id NULL) are GLOBAL and must survive.
//
// GATE ASSERTIONS on deleteWorldCascade(A):
//   pt6 count===rows : count.total === (rows before) - (rows after) over the
//                      world-scoped tables; breakdown matches the seeded fixture.
//   pt1 unlink-not-delete + cross-world isolation : the shared entity ROW SURVIVES
//        and is STILL linked to sibling world B; the a-only entity ROW SURVIVES
//        (only its A membership is gone).
//   pt4 built-in global survival : all 4 built-ins (world_id NULL) survive; a
//        surviving entity's kind still resolves to a live category.
//   + idempotency : a second deleteWorldCascade(A) removes nothing (total 0).
//   + is_builtin : userCatA (is_builtin false) is gone; built-ins (is_builtin true)
//        remain.
//
// SHARED-DB HYGIENE: ids are `test-w2-*`; afterAll hard-deletes residue in FK
// order. universe-1 and its built-ins are never structurally deleted.
// -----------------------------------------------------------------------------

loadEnv();

const confirm = confirmWikiWrite({ confirmed: true });

const worldAId = `test-w2-world-${randomUUID()}`;
const worldBId = `test-w2-world-${randomUUID()}`;
const sharedEntId = `test-w2-ent-${randomUUID()}`;
const aOnlyEntId = `test-w2-ent-${randomUUID()}`;
const userCatAId = `test-w2-cat-${randomUUID()}`;

// Count ONLY this fixture's own rows across the world-scoped tables that
// deleteWorldCascade touches, so `total === before - after` is immune to any
// concurrent writer (parallel test file OR a stray psql). Global COUNT(*) here
// would be perturbed by anyone else's rows even under serial execution, so we
// key strictly on the fixture ids (coordinator ruling D — fixture-scoped counts).
const FIXTURE_WORLD_IDS = [worldAId, worldBId];
const FIXTURE_CAT_IDS = [userCatAId];

const COUNT_FIXTURE = `SELECT
    (SELECT COUNT(*) FROM world_entities WHERE world_id = ANY($1)) +
    (SELECT COUNT(*) FROM categories WHERE id = ANY($2)) +
    (SELECT COUNT(*) FROM worlds WHERE id = ANY($1)) AS n`;

async function totalRows(): Promise<number> {
  const r = await one<{ n: string }>(COUNT_FIXTURE, [FIXTURE_WORLD_IDS, FIXTURE_CAT_IDS]);
  return Number(r!.n);
}

async function builtinCount(): Promise<number> {
  const r = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM categories WHERE is_builtin = true AND world_id IS NULL`,
  );
  return Number(r!.n);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // Residue cleanup in FK order (happy path deletes worldA; this covers a failed
  // run and worldB / the surviving entities the world delete deliberately leaves).
  await query(`DELETE FROM world_entities WHERE world_id = ANY($1)`, [[worldAId, worldBId]]);
  await query(`DELETE FROM categories WHERE id = ANY($1)`, [[userCatAId]]);
  await query(`DELETE FROM entries WHERE id = ANY($1)`, [[sharedEntId, aOnlyEntId]]);
  await query(`DELETE FROM worlds WHERE id = ANY($1)`, [[worldAId, worldBId]]);
  await closePool();
});

describe("W-2 deleteWorldCascade (real Postgres)", () => {
  it("unlinks entities + drops user cats; entities, sibling world, built-ins survive; count===rows", async () => {
    // --- Seed two sibling worlds under the SAME universe -----------------------
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
      [worldAId, DEFAULT_UNIVERSE_ID, "World A", 0],
    );
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
      [worldBId, DEFAULT_UNIVERSE_ID, "World B", 1],
    );

    // A shared entity (real entries row) linked to BOTH worlds, and an A-only one.
    await insertEntry(
      { id: sharedEntId, kind: "character", name: "Shared One", catalogueNo: "W2-1", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: DEFAULT_UNIVERSE_ID },
      confirm,
    );
    await insertEntry(
      { id: aOnlyEntId, kind: "character", name: "A Only", catalogueNo: "W2-2", note: "", summary: "", shelf: "characters", sortOrder: 1, universeId: DEFAULT_UNIVERSE_ID },
      confirm,
    );
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldAId, sharedEntId]);
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldBId, sharedEntId]);
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldAId, aOnlyEntId]);

    // A per-world USER category on A (world_id = A, is_builtin false).
    await query(
      `INSERT INTO categories (id, label, shelf, sort_order, is_builtin, world_id)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [userCatAId, "Relics", "places", 99, worldAId],
    );

    const builtinsBefore = await builtinCount();
    const totalBefore = await totalRows();

    // --- ACT ------------------------------------------------------------------
    const count = await deleteWorldCascade(worldAId);

    const totalAfter = await totalRows();

    // pt1 — UNLINK-not-delete + cross-world isolation. Asserted FIRST so the
    // entity-cascade mutant (junction DELETE -> entity DELETE) flips THIS
    // (the semantically-correct pt1 signal), not just the count below.
    // The shared entity ROW survives (never cascade-deleted).
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [sharedEntId])).not.toBeNull();
    // The a-only entity ROW survives too (only its A membership is gone).
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [aOnlyEntId])).not.toBeNull();
    // A's memberships are gone.
    expect(await one(`SELECT 1 FROM world_entities WHERE world_id = $1`, [worldAId])).toBeNull();
    // But the shared entity is STILL linked to sibling world B (isolation).
    expect(
      await one(`SELECT 1 FROM world_entities WHERE world_id = $1 AND entity_id = $2`, [worldBId, sharedEntId]),
    ).not.toBeNull();
    // Sibling world B row survives.
    expect(await one(`SELECT id FROM worlds WHERE id = $1`, [worldBId])).not.toBeNull();

    // pt4 — built-in global survival. All 4 built-ins (world_id NULL) remain, and
    // a surviving entity's kind still resolves to a live category. Asserted before
    // the count so the `OR world_id IS NULL` mutant flips THIS (built-in caught ->
    // kind FK dangles) as its pt4 signal.
    expect(await builtinCount()).toBe(builtinsBefore);
    const kindResolves = await one(
      `SELECT c.id FROM entries e JOIN categories c ON c.id = e.kind WHERE e.id = $1`,
      [sharedEntId],
    );
    expect(kindResolves).not.toBeNull();

    // is_builtin — the user category is gone; the world row is gone.
    expect(await one(`SELECT id FROM categories WHERE id = $1`, [userCatAId])).toBeNull();
    expect(await one(`SELECT id FROM worlds WHERE id = $1`, [worldAId])).toBeNull();

    // pt6 — count === rows actually removed (asserted last; the `AND false` mutant
    // on a counted DELETE flips THIS: total drops AND userCatA survives above).
    expect(count.total).toBe(totalBefore - totalAfter);
    // Breakdown matches the fixture: 2 junction rows (shared+aOnly under A),
    // 1 user category, 1 world row. No books/entries counted.
    expect(count.worldEntities).toBe(2);
    expect(count.categories).toBe(1);
    expect(count.worlds).toBe(1);
    expect(count.entries).toBe(0);
    expect(count.books).toBe(0);

    // idempotency — a second delete removes nothing.
    const again = await deleteWorldCascade(worldAId);
    expect(again.total).toBe(0);
    expect(again.worldEntities).toBe(0);
    expect(again.categories).toBe(0);
    expect(again.worlds).toBe(0);
  });
});
