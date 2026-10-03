import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query, withTransaction } from "@/server/db/pool";

// Every world starts with one research thread, so /research is never empty.
async function insertFirstThread(client: PoolClient, worldId: string): Promise<void> {
  await client.query(
    `INSERT INTO research_threads (id, world_id, title) VALUES ($1, $2, 'New thread')`,
    [randomUUID(), worldId],
  );
}

export async function renameWorld(input: {
  id: string;
  title: string;
}): Promise<void> {
  const title = input.title.trim();
  if (title === "") return;
  await query(
    `UPDATE worlds SET name = $2 WHERE id = $1`,
    [input.id, title],
  );
}

export async function renameUniverse(input: {
  id: string;
  name: string;
}): Promise<void> {
  const name = input.name.trim();
  if (name === "") return;
  await query(
    `UPDATE universes SET name = $2 WHERE id = $1`,
    [input.id, name],
  );
}

export async function renameBook(input: {
  id: string;
  name: string;
}): Promise<void> {
  const name = input.name.trim();
  if (name === "") return;
  await query(
    `UPDATE books SET name = $2 WHERE id = $1`,
    [input.id, name],
  );
}

export interface UniverseRow {
  id: string;
  name: string;
}
export interface BookRow {
  id: string;
  worldId: string;
  name: string;
  sortOrder: number;
}

export async function insertBookWithFirstChapter(input: {
  id: string;
  name: string;
  worldId: string;
  sortOrder?: number;
  firstChapterId: string;
  firstChapterTitle: string;
  firstChapterBody: unknown;
}): Promise<BookRow> {
  const worldId = input.worldId;
  return withTransaction(async (client) => {
    const nextSort =
      input.sortOrder ??
      (
        await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM books WHERE world_id = $1`,
          [worldId],
        )
      ).rows[0]!.next;
    const res = await client.query<BookRow>(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, world_id AS "worldId", name, sort_order AS "sortOrder"`,
      [input.id, worldId, input.name, nextSort],
    );
    await client.query(
      `INSERT INTO chapters (id, book_id, number, title, body)
       VALUES ($1, $2, 1, $3, $4)`,
      [input.firstChapterId, input.id, input.firstChapterTitle, JSON.stringify(input.firstChapterBody)],
    );
    if (!res.rows[0]) throw new Error("insertBookWithFirstChapter: no book row returned");
    return res.rows[0];
  });
}

export async function createFreshUniverse(input: {
  universeId: string;
  worldId: string;
  bookId: string;
  universeName: string;
  worldName?: string;
  bookName?: string;
}): Promise<{ universe: UniverseRow; world: WorldRow; book: BookRow }> {
  return withTransaction(async (client) => {
    const uni = await client.query<UniverseRow>(
      `INSERT INTO universes (id, name, sort_order)
       SELECT $1, $2, COALESCE(MAX(sort_order) + 1, 0) FROM universes
       RETURNING id, name`,
      [input.universeId, input.universeName],
    );
    const world = await client.query<WorldRow>(
      `INSERT INTO worlds (id, universe_id, name, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, universe_id AS "universeId", name AS title, sort_order AS "sortOrder"`,
      [input.worldId, input.universeId, input.worldName ?? input.universeName],
    );
    const bk = await client.query<BookRow>(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, 0)
       RETURNING id, world_id AS "worldId", name, sort_order AS "sortOrder"`,
      [input.bookId, input.worldId, input.bookName ?? input.worldName ?? input.universeName],
    );
    await insertFirstThread(client, input.worldId);
    return { universe: uni.rows[0]!, world: world.rows[0]!, book: bk.rows[0]! };
  });
}

export interface WorldRow {
  id: string;
  universeId: string;
  title: string;
  sortOrder: number;
}

export async function insertWorld(input: {
  id: string;
  universeId: string;
  title: string;
  bookId: string;
  sortOrder?: number;
  bookName?: string;
}): Promise<WorldRow> {
  return withTransaction(async (client) => {
    const sortOrder =
      input.sortOrder ??
      (
        await client.query<{ next: number }>(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM worlds WHERE universe_id = $1`,
          [input.universeId],
        )
      ).rows[0]!.next;
    const world = await client.query<WorldRow>(
      `INSERT INTO worlds (id, universe_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, universe_id AS "universeId", name AS title, sort_order AS "sortOrder"`,
      [input.id, input.universeId, input.title, sortOrder],
    );
    await client.query(
      `INSERT INTO books (id, world_id, name, sort_order)
       VALUES ($1, $2, $3, 0)`,
      [input.bookId, input.id, input.bookName ?? input.title],
    );
    await insertFirstThread(client, input.id);
    return world.rows[0]!;
  });
}

