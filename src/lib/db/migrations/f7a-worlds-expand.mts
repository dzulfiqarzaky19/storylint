// F7 S1a migration: worlds hierarchy EXPAND phase (parent tables + nullable
// scope columns + backfill). Forward-only, idempotent, EXPAND ONLY — this file
// deliberately does NOT enforce any constraint (no SET NOT NULL, no UNIQUE flip);
// that is S1b (f7b-worlds-contract.mts), a separate frozen commit. Keeping expand
// isolated is what lets the reviewer's row-ID diff prove ALTER-not-reseed: a pure
// additive migration touches no row's identity, only stamps a new nullable column.
//
// Apply:  npx tsx src/lib/db/migrations/f7a-worlds-expand.mts
//
// Model (Universe owns the wiki; Series groups Books; Book owns Chapters):
//   universes (id PK, name)
//   series    (id PK, universe_id FK, name, sort_order)
//   books     (id PK, series_id FK, name, sort_order)
//   entries.universe_id            (nullable now; NOT NULL in S1b)
//   chapters.book_id               (nullable now; NOT NULL in S1b)
//   chapter_appearances.book_id    (nullable now; NOT NULL in S1b)
//   research_threads.universe_id   (nullable now; NOT NULL in S1b)
//   facts.book_id / ties.book_id   (nullable, STAY nullable: NULL = universe canon
//                                   shown in every book; non-NULL = book-only facet)
//   entry_facets (entry_id, book_id, name?, summary?, note?) scalar override table
//
// Backfill: one Universe 1 / Series 1 / Book 1, then stamp every existing
// scope-bearing row to it. facts/ties book_id are LEFT NULL (canon) by design.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

// Fixed backfill ids for the single pre-existing world (Ashkeld). Stable, so a
// re-run is a no-op and downstream slices can reference them deterministically.
export const U1 = "universe-1";
export const SE1 = "series-1";
export const B1 = "book-1";

// DDL is split from backfill so intent is legible, but both run in ONE txn below.
const DDL: ReadonlyArray<string> = [
  // Parent tables (structural, not wiki content -> no confirmWikiWrite token).
  `CREATE TABLE IF NOT EXISTS universes (
     id    text PRIMARY KEY,
     name  text NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS series (
     id           text PRIMARY KEY,
     universe_id  text NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
     name         text NOT NULL,
     sort_order   integer NOT NULL DEFAULT 0
   );`,
  `CREATE TABLE IF NOT EXISTS books (
     id          text PRIMARY KEY,
     series_id   text NOT NULL REFERENCES series(id) ON DELETE CASCADE,
     name        text NOT NULL,
     sort_order  integer NOT NULL DEFAULT 0
   );`,
  // entry_facets: sparse per-book SCALAR override. A row exists only when a book
  // diverges from canon on a scalar; the merged book view = COALESCE(facet, canon).
  // NULL column = "no override for this field in this book". PK(entry_id, book_id)
  // = at most one facet row per entry per book.
  `CREATE TABLE IF NOT EXISTS entry_facets (
     entry_id  text NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
     book_id   text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
     name      text,
     summary   text,
     note      text,
     PRIMARY KEY (entry_id, book_id)
   );`,
  // Nullable scope columns on existing tables (EXPAND: nullable now, enforced S1b).
  `ALTER TABLE entries              ADD COLUMN IF NOT EXISTS universe_id text REFERENCES universes(id);`,
  `ALTER TABLE chapters             ADD COLUMN IF NOT EXISTS book_id     text REFERENCES books(id);`,
  `ALTER TABLE chapter_appearances  ADD COLUMN IF NOT EXISTS book_id     text REFERENCES books(id);`,
  `ALTER TABLE research_threads     ADD COLUMN IF NOT EXISTS universe_id text REFERENCES universes(id);`,
  // LIST-divergence scope: NULLABLE and STAYS nullable (NULL = canon). Never enforced.
  `ALTER TABLE facts                ADD COLUMN IF NOT EXISTS book_id     text REFERENCES books(id);`,
  `ALTER TABLE ties                 ADD COLUMN IF NOT EXISTS book_id     text REFERENCES books(id);`,
  // Supporting indexes for the scoped reads S2 introduces.
  `CREATE INDEX IF NOT EXISTS idx_entries_universe            ON entries (universe_id);`,
  `CREATE INDEX IF NOT EXISTS idx_chapters_book               ON chapters (book_id);`,
  `CREATE INDEX IF NOT EXISTS idx_appearances_book_chapter    ON chapter_appearances (book_id, chapter);`,
  `CREATE INDEX IF NOT EXISTS idx_research_threads_universe   ON research_threads (universe_id);`,
  `CREATE INDEX IF NOT EXISTS idx_facts_book                  ON facts (book_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ties_book                   ON ties (book_id);`,
  `CREATE INDEX IF NOT EXISTS idx_series_universe             ON series (universe_id);`,
  `CREATE INDEX IF NOT EXISTS idx_books_series                ON books (series_id);`,
];

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    for (const stmt of DDL) {
      await client.query(stmt);
    }

    // L6 — exactly ONE Universe 1 / Series 1 / Book 1. ON CONFLICT DO NOTHING makes
    // a re-run a no-op (idempotent). Series FK -> universe, Book FK -> series.
    await client.query(
      `INSERT INTO universes (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [U1, "Ashkeld"],
    );
    await client.query(
      `INSERT INTO series (id, universe_id, name, sort_order)
       VALUES ($1, $2, $3, 0) ON CONFLICT (id) DO NOTHING`,
      [SE1, U1, "Ashkeld"],
    );
    await client.query(
      `INSERT INTO books (id, series_id, name, sort_order)
       VALUES ($1, $2, $3, 0) ON CONFLICT (id) DO NOTHING`,
      [B1, SE1, "Ashkeld"],
    );

    // L1-L3, L5 — stamp every existing scope-bearing row. WHERE <col> IS NULL makes
    // each UPDATE match zero rows on a re-run (idempotent) and never re-stamps a row
    // a later slice may have set to a different scope.
    await client.query(`UPDATE entries             SET universe_id = $1 WHERE universe_id IS NULL`, [U1]); // L1
    await client.query(`UPDATE chapters            SET book_id     = $1 WHERE book_id     IS NULL`, [B1]); // L2
    await client.query(`UPDATE chapter_appearances SET book_id     = $1 WHERE book_id     IS NULL`, [B1]); // L3
    await client.query(`UPDATE research_threads    SET universe_id = $1 WHERE universe_id IS NULL`, [U1]); // L5
    // L4 — facts.book_id / ties.book_id are DELIBERATELY LEFT NULL (universe canon).
    // No UPDATE here is the correct behavior; enforcing that is an assertion, not a write.

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  loadEnv();
  await migrate();
  console.log(
    "[f7a-worlds-expand] applied: universes/series/books + entry_facets, " +
      "nullable scope cols, backfill U1/Se1/B1 (facts/ties.book_id left NULL = canon).",
  );
  await closePool();
}

// Run only when invoked directly (npx tsx …/f7a-worlds-expand.mts), never on
// import — so a test/verify harness can import { migrate } without the module
// self-executing against whatever DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[f7a-worlds-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
