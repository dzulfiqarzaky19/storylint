// F9-B S1b migration: categories CONTRACT phase (FK enforcement). Runs AFTER
// f9a-categories-expand has created + seeded categories and dropped the old
// entries.kind CHECK. This is the frozen contract commit — it ONLY adds the
// referential constraint, touches ZERO rows (every entries.kind already equals a
// seeded category id by construction), so the reviewer's row-ID diff + counts
// stay byte-identical pre/post. Mirrors f7b-worlds-contract.
//
// Apply:  npx tsx src/lib/db/migrations/f9b-categories-contract.mts
//
// Adds:  entries.kind REFERENCES categories(id)  — SOFT FK, no ON DELETE action.
//   Deleting a category SOFT-deletes its entries (stamps deleted_at); the
//   category ROW is never removed, so this FK never cascades. A named constraint
//   (fk_entries_kind_category) lets us guard the add idempotently via the catalog.
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

const FK_NAME = "fk_entries_kind_category";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // Idempotent guard: add the FK only if it is not already present (a re-run is
    // a no-op). No ON DELETE clause => RESTRICT by default, which is correct: a
    // category row is never hard-deleted (delete soft-deletes its entries), so the
    // RESTRICT never fires in practice and can never orphan an entry.
    const hasFk = await constraintExists(client, FK_NAME);
    if (!hasFk) {
      await client.query(
        `ALTER TABLE entries
           ADD CONSTRAINT ${FK_NAME}
           FOREIGN KEY (kind) REFERENCES categories(id)`,
      );
    }

    await client.query("COMMIT");
    console.log(
      `[f9b-categories-contract] applied: entries.kind -> categories(id) soft FK` +
        ` (${hasFk ? "already present" : FK_NAME}).`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function constraintExists(
  client: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  conname: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_constraint WHERE conrelid = 'entries'::regclass AND conname = $1`,
    [conname],
  );
  return res.rows.length > 0;
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
    console.error("[f9b-categories-contract] failed:", err);
    await closePool();
    process.exit(1);
  });
}
