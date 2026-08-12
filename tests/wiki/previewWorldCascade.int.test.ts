import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "@/lib/db/env";
import { query, one, closePool } from "@/lib/db/pool";
import { insertEntry, deleteWorldCascade } from "@/lib/db/mutations";
import { previewWorldCascade } from "@/lib/db/queries";
import { confirmWikiWrite } from "@/lib/actions/confirmation";
import { DEFAULT_UNIVERSE_ID } from "@/lib/db/scope";

// -----------------------------------------------------------------------------
// W-5 (TCK-024) — previewWorldCascade (INTEGRATION, real Postgres). The advisory
// blast-radius count for a WORLD delete. It MUST mirror deleteWorldCascade
// exactly: its total counts the world's world_entities links + the world's user
// categories + the world row, and NEVER counts entries (orphan=LEAVE — the entity
// ROWS survive a world delete, reclaimable in their other worlds).
//
// GATE ASSERTIONS:
//   pt-count : previewWorldCascade(A).total === deleteWorldCascade(A).total ===
//              rows actually removed. The breakdown (worldEntities/categories/
//              worlds) matches the seeded fixture; entries stays 0.
//   pt-leave : a shared entity linked to BOTH A and sibling B — after A is
//              deleted, its ROW SURVIVES and it is STILL linked to B (the preview
//              counted the LINK, never the entry).
//
// FIXTURE — two sibling worlds (A, B) under universe-1, a shared entity linked to
// both, an A-only entity, and a per-world user category on A. Mirrors
// worldEntitiesDelete.int.test.ts. ids are `test-w5-*`; afterAll hard-deletes
// residue in FK order. universe-1 and its built-ins are never touched.
// -----------------------------------------------------------------------------

loadEnv();

const confirm = confirmWikiWrite({ confirmed: true });

const worldAId = `test-w5-world-${randomUUID()}`;
const worldBId = `test-w5-world-${randomUUID()}`;
const sharedEntId = `test-w5-ent-${randomUUID()}`;
const aOnlyEntId = `test-w5-ent-${randomUUID()}`;
const userCatAId = `test-w5-cat-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; integration test needs a live DB (.env.local).");
  }
});

afterAll(async () => {
  // Residue cleanup in FK order (the happy path deletes worldA; this covers a
  // failed run and worldB / the surviving entities the delete deliberately keeps).
  await query(`DELETE FROM world_entities WHERE world_id = ANY($1)`, [[worldAId, worldBId]]);
  await query(`DELETE FROM categories WHERE id = ANY($1)`, [[userCatAId]]);
  await query(`DELETE FROM entries WHERE id = ANY($1)`, [[sharedEntId, aOnlyEntId]]);
  await query(`DELETE FROM worlds WHERE id = ANY($1)`, [[worldAId, worldBId]]);
  await closePool();
});

describe("W-5 previewWorldCascade (real Postgres)", () => {
  it("preview.total === deleteWorldCascade total === rows removed; shared entity SURVIVES + stays linked to sibling", async () => {
    // --- Seed two sibling worlds under the SAME universe ----------------------
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
      [worldAId, DEFAULT_UNIVERSE_ID, "W5 World A", 0],
    );
    await query(
      `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
      [worldBId, DEFAULT_UNIVERSE_ID, "W5 World B", 1],
    );

    // A shared entity (real entries row) linked to BOTH worlds, and an A-only one.
    await insertEntry(
      { id: sharedEntId, kind: "character", name: "W5 Shared", catalogueNo: "W5-1", note: "", summary: "", shelf: "characters", sortOrder: 0, universeId: DEFAULT_UNIVERSE_ID },
      confirm,
    );
    await insertEntry(
      { id: aOnlyEntId, kind: "character", name: "W5 A Only", catalogueNo: "W5-2", note: "", summary: "", shelf: "characters", sortOrder: 1, universeId: DEFAULT_UNIVERSE_ID },
      confirm,
    );
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldAId, sharedEntId]);
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldBId, sharedEntId]);
    await query(`INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)`, [worldAId, aOnlyEntId]);

    // A per-world USER category on A (world_id = A, is_builtin false).
    await query(
      `INSERT INTO categories (id, label, shelf, sort_order, is_builtin, world_id)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [userCatAId, "W5 Relics", "places", 99, worldAId],
    );

    // --- ADVISORY preview BEFORE the delete -----------------------------------
    const preview = await previewWorldCascade(worldAId);
    // Breakdown mirrors the fixture: 2 junction rows (shared + aOnly under A),
    // 1 user category, 1 world row. Entries are NEVER counted (orphan=LEAVE).
    expect(preview.worldEntities).toBe(2);
    expect(preview.categories).toBe(1);
    expect(preview.worlds).toBe(1);
    expect(preview.entries).toBe(0);
    expect(preview.books).toBe(0);
    expect(preview.total).toBe(4);

    // --- ACT: the authoritative delete ----------------------------------------
    const count = await deleteWorldCascade(worldAId);

    // pt-count — preview matched the delete matched the rows removed.
    expect(preview.total).toBe(count.total);
    expect(preview.worldEntities).toBe(count.worldEntities);
    expect(preview.categories).toBe(count.categories);
    expect(preview.worlds).toBe(count.worlds);

    // pt-leave — the shared entity ROW SURVIVES (never deleted; the preview counted
    // the LINK, not the entry) and is STILL linked to sibling world B.
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [sharedEntId])).not.toBeNull();
    expect(await one(`SELECT id FROM entries WHERE id = $1`, [aOnlyEntId])).not.toBeNull();
    expect(
      await one(`SELECT 1 FROM world_entities WHERE world_id = $1 AND entity_id = $2`, [worldBId, sharedEntId]),
    ).not.toBeNull();
    // World A and its memberships/user category are gone.
    expect(await one(`SELECT id FROM worlds WHERE id = $1`, [worldAId])).toBeNull();
    expect(await one(`SELECT 1 FROM world_entities WHERE world_id = $1`, [worldAId])).toBeNull();
    expect(await one(`SELECT id FROM categories WHERE id = $1`, [userCatAId])).toBeNull();
  });

  it("preview of an EMPTY (no links, no user cats) world counts only the world row", async () => {
    // worldB has no world_entities of its own except the shared link, and no user
    // categories. Its preview: 1 shared link + 0 categories + 1 world row = 2.
    const preview = await previewWorldCascade(worldBId);
    expect(preview.worldEntities).toBe(1); // the shared entity's B-link
    expect(preview.categories).toBe(0);
    expect(preview.worlds).toBe(1);
    expect(preview.total).toBe(2);
  });
});
