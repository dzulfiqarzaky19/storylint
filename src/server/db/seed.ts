import { loadEnv } from "./env";
import { getPool, closePool, withTransaction } from "./pool";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { extractCandidatePhrases } from "@/domain/check/unrecorded";
import { discoverBooks, type Kind, type LoadedBook } from "@/server/db/seed-data/loadBook";

export type { Kind, SeedEntry, SeedChapter } from "@/server/db/seed-data/loadBook";

const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

function bodyOf(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

// `order` is the book's position in discoverBooks(), which puts the default
// novel first, so it is the universe the app lands on.
async function seedBook(client: PoolClient, book: LoadedBook, order: number): Promise<void> {
  await client.query(`INSERT INTO universes (id, name, sort_order) VALUES ($1, $2, $3)`, [
    book.universeId,
    book.universeName.toUpperCase(),
    order,
  ]);
  await client.query(
    `INSERT INTO worlds (id, universe_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
    [book.worldId, book.universeId, book.worldTitle.toUpperCase(), 0],
  );
  await client.query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ($1, $2, $3, 0)`,
    [book.bookId, book.worldId, book.bookName.toUpperCase()],
  );

  for (let i = 0; i < book.entries.length; i++) {
    const e = book.entries[i]!;
    await client.query(
      `INSERT INTO entries (id, universe_id, category_id, name, catalogue_no, note, summary, shelf, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [e.id, book.universeId, e.kind, e.name, e.no, e.note, e.summary, KIND_SHELF[e.kind], i],
    );
    await client.query(
      `INSERT INTO world_entries (world_id, entry_id) VALUES ($1, $2)`,
      [book.worldId, e.id],
    );
  }

  for (let i = 0; i < book.facts.length; i++) {
    const [id, entryId, key, value] = book.facts[i]!;
    await client.query(
      `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [id, entryId, key, value, i],
    );
  }

  for (const [from, to, rel] of book.ties) {
    await client.query(
      `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
       VALUES ($1, $2, $3, $4)`,
      [`tie-${from}-${to}`, from, to, rel],
    );
  }

  for (const c of book.chapters) {
    await client.query(
      `INSERT INTO chapters (id, book_id, number, title, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [c.id, book.bookId, c.number, c.title, JSON.stringify(bodyOf(c.paragraphs))],
    );
    for (const [phrase, count] of extractCandidatePhrases(c.paragraphs)) {
      await client.query(
        `INSERT INTO phrase_mentions (chapter_id, phrase, count) VALUES ($1, $2, $3)`,
        [c.id, phrase, count],
      );
    }
  }

  for (const pl of book.plotlines) {
    await client.query(
      `INSERT INTO entries (id, universe_id, category_id, name, catalogue_no, note, summary, shelf, sort_order)
         VALUES ($1, $2, 'plotline', $3, $4, $5, $6, 'plots', 0)`,
      [pl.id, book.universeId, pl.name, `PL-${pl.id}`, pl.label, pl.state],
    );
    await client.query(
      `INSERT INTO world_entries (world_id, entry_id) VALUES ($1, $2)`,
      [book.worldId, pl.id],
    );
    if (pl.ownerEntryId) {
      await client.query(
        `INSERT INTO entry_plotlines (entry_id, plotline_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [pl.ownerEntryId, pl.id],
      );
    }
    for (const b of pl.beats) {
      await client.query(
        `INSERT INTO beats (chapter_id, plotline_id, summary) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [b.chapterId, pl.id, b.summary],
      );
    }
  }

  await client.query(
    `INSERT INTO research_threads (id, world_id, title) VALUES ($1, $2, 'New thread')`,
    [`thread-${book.slug}-1`, book.worldId],
  );
}

export async function seedWithin(client: PoolClient): Promise<void> {
  // Everything hangs off universes; categories are global, so only the
  // user-made ones go. The built-ins come from schema.sql.
  await client.query(`TRUNCATE TABLE universes CASCADE`);
  await client.query(`DELETE FROM categories WHERE NOT is_builtin`);

  const books = discoverBooks();
  for (let i = 0; i < books.length; i++) {
    await seedBook(client, books[i]!, i);
  }
}

async function main(): Promise<void> {
  loadEnv();
  await withTransaction(seedWithin);

  const counts = await getPool().query<{ table_name: string; n: string }>(`
    SELECT 'entries' AS table_name, count(*)::text AS n FROM entries
    UNION ALL SELECT 'universes', count(*)::text FROM universes
    UNION ALL SELECT 'worlds', count(*)::text FROM worlds
    UNION ALL SELECT 'books', count(*)::text FROM books
    UNION ALL SELECT 'facts', count(*)::text FROM facts
    UNION ALL SELECT 'ties', count(*)::text FROM ties
    UNION ALL SELECT 'chapters', count(*)::text FROM chapters
    UNION ALL SELECT 'research_threads', count(*)::text FROM research_threads
    ORDER BY table_name
  `);
  console.log("[db:seed] loaded:");
  for (const r of counts.rows) console.log(`  ${r.table_name}: ${r.n}`);
  await closePool();
}

const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[db:seed] failed:", err);
    await closePool();
    process.exit(1);
  });
}
