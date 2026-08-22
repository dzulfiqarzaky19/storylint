// Idempotent seed of every prose book in ../novel as its own universe/world/book.
// Postgres via pg. Runs inside one transaction; TRUNCATE first so re-running is safe.
// Usage: npm run db:seed
//
// Data-driven: every `<slug>.chapters.json` in ../novel seeds a book's chapters;
// if a matching `<slug>.extraction.json` exists, that book's wiki (entries/facts/
// ties) and plot (plotlines + beats) seed too. Drop in a new pair of JSON files
// and it seeds with zero code changes. The default book (DEFAULT_BOOK_SLUG) seeds
// first and backs the app's default scope (scope.ts).
import { loadEnv } from "./env";
import { getPool, closePool, withTransaction } from "./pool";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { extractCandidatePhrases } from "../check/unrecorded";
import { discoverBooks, type Kind, type LoadedBook } from "../novel/loadBook";

// Re-exported for the (rare) importer that pulls the row types from the seed; the
// canonical home is now loadBook.ts.
export type { Kind, SeedEntry, SeedChapter } from "../novel/loadBook";

// Shelf derives from kind: character->people, world->places,
// organization->orders, lore->lore.
const KIND_SHELF: Record<Kind, string> = {
  character: "people",
  world: "places",
  organization: "orders",
  lore: "lore",
};

// Built-in categories. Their ids EQUAL the kind enum strings, so every seeded
// entry's `kind` already points at a real category row. Mirrors schema.sql.
const BUILTIN_CATEGORIES: Array<{
  id: Kind;
  label: string;
  shelf: string;
  sortOrder: number;
}> = [
  { id: "character", label: "People", shelf: "people", sortOrder: 0 },
  { id: "world", label: "Places", shelf: "places", sortOrder: 1 },
  { id: "organization", label: "Orders", shelf: "orders", sortOrder: 2 },
  { id: "lore", label: "Lore", shelf: "lore", sortOrder: 3 },
];

function bodyOf(paragraphs: string[]) {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

// Seed one book into its own universe/world/book. Wiki + plot are seeded only when
// the book carries them (an extraction.json was present); a chapters-only book
// still gets a full, browsable hierarchy with its prose.
async function seedBook(client: PoolClient, book: LoadedBook, worldSort: number): Promise<void> {
  await client.query(`INSERT INTO universes (id, name) VALUES ($1, $2)`, [
    book.universeId,
    book.universeName.toUpperCase(),
  ]);
  await client.query(
    `INSERT INTO worlds (id, universe_id, title, sort_order) VALUES ($1, $2, $3, $4)`,
    [book.worldId, book.universeId, book.worldTitle.toUpperCase(), worldSort],
  );
  await client.query(
    `INSERT INTO books (id, world_id, name, sort_order) VALUES ($1, $2, $3, 0)`,
    [book.bookId, book.worldId, book.bookName.toUpperCase()],
  );

  // Entries + explicit world membership.
  for (let i = 0; i < book.entries.length; i++) {
    const e = book.entries[i]!;
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [e.id, e.kind, e.name, e.no, e.note, e.summary, KIND_SHELF[e.kind], i, book.universeId],
    );
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
      [book.worldId, e.id],
    );
  }

  // Facts.
  for (let i = 0; i < book.facts.length; i++) {
    const [id, entryId, key, value] = book.facts[i]!;
    await client.query(
      `INSERT INTO facts (id, entry_id, key, value, fresh, sort_order)
       VALUES ($1, $2, $3, $4, false, $5)`,
      [id, entryId, key, value, i],
    );
  }

  // Ties.
  for (const [from, to, rel] of book.ties) {
    await client.query(
      `INSERT INTO ties (id, from_entry_id, to_entry_id, rel)
       VALUES ($1, $2, $3, $4)`,
      [`tie-${from}-${to}`, from, to, rel],
    );
  }

  // Chapters (real prose). Each body loads into the Write screen; marks derive live.
  // phrase_mentions is the book-wide recurrence index the check engine reads.
  for (const c of book.chapters) {
    await client.query(
      `INSERT INTO chapters (id, number, title, body, book_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [c.id, c.number, c.title, JSON.stringify(bodyOf(c.paragraphs)), book.bookId],
    );
    for (const [phrase, count] of extractCandidatePhrases(c.paragraphs)) {
      await client.query(
        `INSERT INTO phrase_mentions (phrase, chapter_number, count)
         VALUES ($1, $2, $3)
         ON CONFLICT (phrase, chapter_number) DO UPDATE SET count = EXCLUDED.count`,
        [phrase, c.number, count],
      );
    }
  }

  // Plotlines: entry (kind='plotline') + world membership + owner link + beats.
  for (const pl of book.plotlines) {
    await client.query(
      `INSERT INTO entries (id, kind, name, catalogue_no, note, summary, shelf, sort_order, universe_id)
         VALUES ($1, 'plotline', $2, $3, $4, $5, 'plots', 0, $6)`,
      [pl.id, pl.name, `PL-${pl.id}`, pl.label, pl.state, book.universeId],
    );
    await client.query(
      `INSERT INTO world_entities (world_id, entity_id) VALUES ($1, $2)
       ON CONFLICT (world_id, entity_id) DO NOTHING`,
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
        `INSERT INTO chapter_plotlines (chapter_id, plotline_id, summary) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [b.chapterId, pl.id, b.summary],
      );
    }
  }

  // One default research thread so /research is never "Threads 0" on this world.
  await client.query(
    `INSERT INTO research_threads (id, title, subtitle, sort_order, scope, universe_id, world_id)
     VALUES ($1, 'New thread', '', 0, 'chat', $2, $3)`,
    [`thread-${book.slug}-1`, book.universeId, book.worldId],
  );
}

export async function seedWithin(client: PoolClient): Promise<void> {
  // Idempotent: clear everything, then insert. CASCADE covers FK children.
  await client.query(`
    TRUNCATE TABLE
      universes, books, entry_facets,
      worlds, world_entities,
      categories,
      entries, facts, ties, chapter_appearances, open_questions,
      chapters, research_threads, research_turns, propositions, kept_cards,
      resolved_marks, dismissed_suggestions, phrase_mentions
    RESTART IDENTITY CASCADE
  `);

  // Built-in categories BEFORE entries: entries.kind is a soft FK to categories(id).
  for (const c of BUILTIN_CATEGORIES) {
    await client.query(
      `INSERT INTO categories (id, label, shelf, sort_order, is_builtin)
       VALUES ($1, $2, $3, $4, true)`,
      [c.id, c.label, c.shelf, c.sortOrder],
    );
  }

  // Every book in ../novel, default first (it backs scope.ts).
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

// Run-guard: only seed when invoked as the entry script (npm run db:seed). Under
// vitest this module is imported for its exported types/routine; argv[1] is the
// runner, not this file, so main() is skipped and the import is side-effect-free.
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
