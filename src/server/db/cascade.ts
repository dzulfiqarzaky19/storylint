import type { PoolClient } from "pg";
import { getPool } from "./pool";

export type CascadeTarget =
  | { kind: "universe"; id: string }
  | { kind: "world"; id: string }
  | { kind: "book"; id: string };

export interface CascadeCount {
  /** Rows removed per table; tables that lose nothing are omitted. */
  byTable: Record<string, number>;
  total: number;
}

// Foreign keys (ON DELETE CASCADE) remove everything a universe, world or book
// owns. The one thing they cannot express: an entry belongs to a universe but
// lives in worlds through world_entries, so deleting a world must also take the
// entries that were linked to that world and to no other.
async function remove(client: PoolClient, target: CascadeTarget): Promise<void> {
  switch (target.kind) {
    case "universe":
      await client.query(`DELETE FROM universes WHERE id = $1`, [target.id]);
      return;
    case "book":
      await client.query(`DELETE FROM books WHERE id = $1`, [target.id]);
      return;
    case "world":
      await client.query(
        `DELETE FROM entries e
          USING world_entries we
          WHERE we.entry_id = e.id AND we.world_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM world_entries other
               WHERE other.entry_id = e.id AND other.world_id <> $1
            )`,
        [target.id],
      );
      await client.query(`DELETE FROM worlds WHERE id = $1`, [target.id]);
      return;
  }
}

async function rowCounts(client: PoolClient): Promise<Map<string, number>> {
  const tables = await client.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const counts = new Map<string, number>();
  for (const { name } of tables.rows) {
    const res = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${client.escapeIdentifier(name)}`,
    );
    counts.set(name, res.rows[0]?.n ?? 0);
  }
  return counts;
}

// The preview and the delete are the same operation: both run the real delete
// inside a transaction and measure every table before and after. The preview
// rolls back, the delete commits, so the previewed count cannot drift from what
// a delete removes.
async function run(target: CascadeTarget, commit: boolean): Promise<CascadeCount> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const before = await rowCounts(client);
    await remove(client, target);
    const after = await rowCounts(client);
    await client.query(commit ? "COMMIT" : "ROLLBACK");

    const byTable: Record<string, number> = {};
    let total = 0;
    for (const [table, n] of before) {
      const removed = n - (after.get(table) ?? 0);
      if (removed === 0) continue;
      byTable[table] = removed;
      total += removed;
    }
    return { byTable, total };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function previewCascade(target: CascadeTarget): Promise<CascadeCount> {
  return run(target, false);
}

export function deleteCascade(target: CascadeTarget): Promise<CascadeCount> {
  return run(target, true);
}
