import { rows, one } from "@/server/db/pool";
import type { WorldUniverseNode } from "@/domain/structure";

export async function getWorldTree(): Promise<WorldUniverseNode[]> {
  const universes = await rows<{ id: string; name: string }>(
    `SELECT id, name FROM universes ORDER BY sort_order, id`,
  );
  const books = await rows<{ id: string; name: string; worldId: string; sortOrder: number }>(
    `SELECT id, name, world_id AS "worldId", sort_order AS "sortOrder"
       FROM books ORDER BY sort_order, id`,
  );
  const worlds = await rows<{ id: string; title: string; universeId: string; sortOrder: number }>(
    `SELECT id, name AS title, universe_id AS "universeId", sort_order AS "sortOrder"
       FROM worlds ORDER BY sort_order, id`,
  );

  return universes.map((u) => ({
    id: u.id,
    name: u.name,
    worlds: worlds
      .filter((w) => w.universeId === u.id)
      .map((w) => ({
        id: w.id,
        title: w.title,
        sortOrder: w.sortOrder,
        books: books
          .filter((b) => b.worldId === w.id)
          .map((b) => ({ id: b.id, name: b.name, sortOrder: b.sortOrder })),
      })),
  }));
}

export async function getBook(bookId: string): Promise<{ title: string } | null> {
  return one<{ title: string }>(
    `SELECT name AS title FROM books WHERE id = $1`,
    [bookId],
  );
}

export async function countStructureSiblings(
  level: "world" | "book",
  id: string,
): Promise<number> {
  const sql =
    level === "world"
      ? `SELECT COUNT(*) AS n FROM worlds
          WHERE universe_id = (SELECT universe_id FROM worlds WHERE id = $1)`
      : `SELECT COUNT(*) AS n FROM books
          WHERE world_id = (SELECT world_id FROM books WHERE id = $1)`;
  const r = await one<{ n: string }>(sql, [id]);
  return r ? Number(r.n) : 0;
}
