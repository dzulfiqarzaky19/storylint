// ============================================================================
// World membership write helpers (TCK-023 share/unshare)
// Split out of the former monolithic gazetteer-mutations.ts (T-ARCH-12). Product
// rule 1 (WikiWriteConfirmation token) and all SQL are unchanged; only file
// boundaries moved.
// ============================================================================

import { one, query, rows, withTransaction } from "../pool";
import { type WikiWriteConfirmation } from "../../actions/confirmation";

/**
 * TCK-023 (W-4b): LINK an existing entity into a world (share it). Inserts one
 * membership row. IDEMPOTENT: ON CONFLICT (world_id, entity_id) DO NOTHING means a
 * double-link leaves EXACTLY ONE row (never a PK violation, never a duplicate).
 * The entity's HOME-world membership and every other link are untouched.
 */
export async function linkEntityToWorld(worldId: string, entityId: string): Promise<void> {
  await query(
    `INSERT INTO world_entities (world_id, entity_id)
     VALUES ($1, $2)
     ON CONFLICT (world_id, entity_id) DO NOTHING`,
    [worldId, entityId],
  );
}

/**
 * TCK-023 (W-4b) + orphan=DELETE-on-last-link: UNLINK an entity from a world (stop
 * sharing it there). Drops that membership row; if it was the entity's LAST world
 * link, the entity ROW (and its ON DELETE CASCADE children: facts/ties/facets/
 * appearances/open_questions/plotline edges) is deleted too — an entity with zero
 * world links is unreachable dead data, never a kept orphan. A link into any OTHER
 * world keeps the entity alive there. Both steps run in ONE transaction so a
 * concurrent re-link can't strand a half-deleted entity. Unlink of a NON-member is
 * a no-op (0 rows removed, entity untouched, no throw).
 */
export async function unlinkEntityFromWorld(worldId: string, entityId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM world_entities WHERE world_id = $1 AND entity_id = $2`,
      [worldId, entityId],
    );
    // Last link gone -> the entity follows. NOT EXISTS is evaluated AFTER the
    // unlink above (same txn), so an entity still linked elsewhere is spared.
    await client.query(
      `DELETE FROM entries e
        WHERE e.id = $1
          AND NOT EXISTS (SELECT 1 FROM world_entities we WHERE we.entity_id = e.id)`,
      [entityId],
    );
  });
}

// ---- Entry facets (F7 S4 scalar override) ---------------------------------
// A facet is a per-book SCALAR override of an entry (name/summary/note). Unlike
// the structural universe/series/book inserts above, a facet IS wiki CONTENT
// (it changes what a reader sees for an entry), so per product rule 1 it REQUIRES
// a WikiWriteConfirmation token — same gate as insertFact/insertEntry.
