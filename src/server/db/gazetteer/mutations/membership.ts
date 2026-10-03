import { query, withTransaction } from "@/server/db/pool";

export async function linkEntityToWorld(worldId: string, entityId: string): Promise<void> {
  await query(
    `INSERT INTO world_entries (world_id, entry_id)
     VALUES ($1, $2)
     ON CONFLICT (world_id, entry_id) DO NOTHING`,
    [worldId, entityId],
  );
}

export async function unlinkEntityFromWorld(worldId: string, entityId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `DELETE FROM world_entries WHERE world_id = $1 AND entry_id = $2`,
      [worldId, entityId],
    );
    await client.query(
      `DELETE FROM entries e
        WHERE e.id = $1
          AND NOT EXISTS (SELECT 1 FROM world_entries we WHERE we.entry_id = e.id)`,
      [entityId],
    );
  });
}

