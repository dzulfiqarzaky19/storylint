// F6 S1 migration: soft-delete support + per-kind category labels.
// Forward-only, idempotent (IF NOT EXISTS guards), DDL ONLY — touches no rows.
// Apply:  npx tsx src/lib/db/migrations/f6-soft-delete.mts
//
// 1. entries.deleted_at (nullable bigint, epoch millis, default NULL): a "delete"
//    sets this instead of removing the row, so the ON DELETE CASCADE on
//    facts/ties/chapter_appearances/open_questions NEVER fires and every
//    referencing row survives to be rendered as a dangling "removed" tombstone.
// 2. category_labels(kind PK, label): display-name override per fixed kind enum.
//    Reads coalesce label ?? default; kind stays the CHECK-constrained enum.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

const STATEMENTS: ReadonlyArray<string> = [
  `ALTER TABLE entries ADD COLUMN IF NOT EXISTS deleted_at bigint;`,
  `CREATE TABLE IF NOT EXISTS category_labels (
     kind   text PRIMARY KEY
            CHECK (kind IN ('character', 'world', 'organization', 'lore')),
     label  text NOT NULL
   );`,
];

export async function migrate(): Promise<void> {
  // One transaction: all-or-nothing. Both statements are idempotent, so a re-run
  // after a partial failure is safe.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const stmt of STATEMENTS) {
      await client.query(stmt);
    }
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
  console.log("[f6-soft-delete] applied: entries.deleted_at + category_labels.");
  await closePool();
}

main().catch(async (err) => {
  console.error("[f6-soft-delete] failed:", err);
  await closePool();
  process.exit(1);
});
