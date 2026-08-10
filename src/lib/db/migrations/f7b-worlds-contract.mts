// F7 S1b migration: worlds hierarchy CONTRACT phase (constraint enforcement).
// Runs AFTER f7a-worlds-expand has stamped every scope-bearing row. This file is
// the frozen contract commit — it ONLY enforces constraints, touches ZERO rows,
// so the reviewer's G4 row-ID diff + counts stay byte-identical pre/post.
//
// Apply:  npx tsx src/lib/db/migrations/f7b-worlds-contract.mts
//
// L7 — SET NOT NULL on the four backfilled scope columns (entries.universe_id,
//   chapters.book_id, chapter_appearances.book_id, research_threads.universe_id).
//   facts.book_id / ties.book_id STAY nullable (NULL = universe canon, by design).
//
// L8 — flip chapters uniqueness from a GLOBAL UNIQUE(number) to per-book
//   UNIQUE(book_id, number) so each book restarts at Chapter 1. Two traps handled:
//     P1: the old unique is declared INLINE in schema.sql (`number ... UNIQUE`), so
//         Postgres AUTO-NAMES it. We must NOT hardcode `chapters_number_key`; we
//         resolve the real constraint name from pg_constraint at migration time and
//         DROP by that name.
//     NOT-NULL preservation: dropping the UNIQUE must leave `number` NOT NULL
//         intact (SET NOT NULL is a separate column property, not the constraint),
//         which we assert post-flip.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

// The four columns f7a backfilled and this phase now makes mandatory.
const NOT_NULL_COLUMNS: ReadonlyArray<{ table: string; column: string }> = [
  { table: "entries", column: "universe_id" },
  { table: "chapters", column: "book_id" },
  { table: "chapter_appearances", column: "book_id" },
  { table: "research_threads", column: "universe_id" },
];

const PER_BOOK_UNIQUE = "chapters_book_number_key";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // --- L7: enforce NOT NULL on the backfilled scope columns. Idempotent: SET NOT
    // NULL on an already-NOT-NULL column is a no-op. facts/ties are deliberately
    // absent from this list.
    for (const { table, column } of NOT_NULL_COLUMNS) {
      await client.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`);
    }

    // --- L8 (P1): resolve the REAL name of chapters' global unique on `number`.
    // The old inline `number integer NOT NULL UNIQUE` is auto-named by Postgres, so
    // we look it up rather than hardcoding it. We target the single-column unique on
    // `number` specifically (not the new per-book unique, should this re-run).
    const dropped = await dropGlobalNumberUnique(client);

    // --- L8: add the per-book unique. IF NOT EXISTS-style guard via catalog check so
    // a re-run is a no-op.
    const hasPerBook = await constraintExists(client, PER_BOOK_UNIQUE);
    if (!hasPerBook) {
      await client.query(
        `ALTER TABLE chapters ADD CONSTRAINT ${PER_BOOK_UNIQUE} UNIQUE (book_id, number)`,
      );
    }

    // --- Assert `number` is still NOT NULL after the flip (dropping the UNIQUE must
    // not have relaxed the column). Fail loud inside the txn if it did.
    const numberNotNull = await columnIsNotNull(client, "chapters", "number");
    if (!numberNotNull) {
      throw new Error(
        "[f7b-worlds-contract] invariant broken: chapters.number lost NOT NULL during the UNIQUE flip",
      );
    }

    await client.query("COMMIT");
    console.log(
      `[f7b-worlds-contract] applied: NOT NULL on 4 scope cols; chapters unique flipped` +
        ` (dropped ${dropped ?? "<none>"} -> ${PER_BOOK_UNIQUE}); number still NOT NULL.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Drop chapters' GLOBAL unique on `number` by its real (auto-generated) name.
 * Resolves the name from pg_constraint: a UNIQUE constraint on chapters whose key
 * is exactly the single column `number`. Returns the dropped name, or null if it
 * was already gone (idempotent re-run). Deliberately ignores the per-book unique
 * (book_id, number), which has two key columns.
 */
async function dropGlobalNumberUnique(client: {
  query: (t: string, p?: unknown[]) => Promise<{ rows: Array<{ conname: string }> }>;
}): Promise<string | null> {
  const res = await client.query(
    `SELECT c.conname
       FROM pg_constraint c
      WHERE c.conrelid = 'chapters'::regclass
        AND c.contype = 'u'
        AND (
          SELECT array_agg(a.attname ORDER BY a.attname)
            FROM unnest(c.conkey) AS k(attnum)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ) = ARRAY['number']::name[]`,
  );
  const name = res.rows[0]?.conname ?? null;
  if (name) {
    await client.query(`ALTER TABLE chapters DROP CONSTRAINT "${name}"`);
  }
  return name;
}

async function constraintExists(
  client: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  conname: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_constraint WHERE conrelid = 'chapters'::regclass AND conname = $1`,
    [conname],
  );
  return res.rows.length > 0;
}

async function columnIsNotNull(
  client: { query: (t: string, p?: unknown[]) => Promise<{ rows: Array<{ attnotnull: boolean }> }> },
  table: string,
  column: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT a.attnotnull
       FROM pg_attribute a
      WHERE a.attrelid = $1::regclass AND a.attname = $2 AND a.attnum > 0 AND NOT a.attisdropped`,
    [table, column],
  );
  return res.rows[0]?.attnotnull === true;
}

async function main(): Promise<void> {
  loadEnv();
  await migrate();
  await closePool();
}

// Run only when invoked directly, never on import — so a verify harness can
// import { migrate } without the module self-executing against whatever
// DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[f7b-worlds-contract] failed:", err);
    await closePool();
    process.exit(1);
  });
}
