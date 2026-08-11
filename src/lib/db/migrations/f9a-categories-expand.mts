// F9-B S1a migration: categories EXPAND phase. Forward-only, idempotent,
// EXPAND ONLY — creates the `categories` table, seeds the 4 built-ins, folds any
// existing category_labels overrides into categories.label, then DROPs the old
// entries.kind CHECK enum and retires the category_labels table. It deliberately
// does NOT add the entries.kind -> categories(id) FK; that is S1b
// (f9b-categories-contract.mts), a separate frozen commit — mirroring the
// f7a-expand / f7b-contract split. Keeping expand FK-free is what lets the
// reviewer's row-ID diff prove ALTER-not-reseed: this migration only adds a new
// table + seed rows and relaxes a constraint, never rewrites an entry's identity.
//
// Apply:  npx tsx src/lib/db/migrations/f9a-categories-expand.mts
//
// Model (categories REPLACES category_labels; ids = the historic kind enum):
//   categories (id PK, label, shelf, sort_order, is_builtin, deleted_at)
//     seeded: character/world/organization/lore with ids EQUAL to the enum
//     strings, so entries.kind already references a valid category id — NO
//     backfill of entries is needed.
//   category_labels.label values are folded into categories.label (single source
//     for the header text), then category_labels is DROPPED.
//   entries.kind CHECK constraint is DROPPED (the enum is now a data table).
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

// The 4 built-in categories. ids MUST equal the historic entries.kind enum
// strings so no entry row needs rewriting. Labels are the shelf defaults
// (SHELF_TITLES); shelf/sort_order mirror KIND_SHELF and the shelf display order.
// Kept in this module (not imported from domain) so the migration is standalone.
export const BUILTIN_CATEGORIES: ReadonlyArray<{
  id: string;
  label: string;
  shelf: string;
  sortOrder: number;
}> = [
  { id: "character", label: "People", shelf: "people", sortOrder: 0 },
  { id: "world", label: "Places", shelf: "places", sortOrder: 1 },
  { id: "organization", label: "Orders", shelf: "orders", sortOrder: 2 },
  { id: "lore", label: "Lore", shelf: "lore", sortOrder: 3 },
];

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // 1. Create the categories table (IF NOT EXISTS => idempotent).
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          text PRIMARY KEY,
        label       text NOT NULL,
        shelf       text NOT NULL,
        sort_order  integer NOT NULL DEFAULT 0,
        is_builtin  boolean NOT NULL DEFAULT false,
        deleted_at  bigint
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (sort_order, id)`,
    );

    // 2. Seed the 4 built-ins. ON CONFLICT (id) DO NOTHING makes a re-run a no-op
    // and — critically — NEVER re-stamps a label a later rename may have changed
    // (the id is the identity; the seed only establishes it, never overwrites it).
    for (const c of BUILTIN_CATEGORIES) {
      await client.query(
        `INSERT INTO categories (id, label, shelf, sort_order, is_builtin)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.label, c.shelf, c.sortOrder],
      );
    }

    // 3. Fold any existing category_labels override into categories.label, so the
    // writer's prior renames survive the table swap. Guarded on the table's
    // existence (a fresh DB seeded from schema.sql has no category_labels) so a
    // re-run after the DROP below is a harmless no-op. The UPDATE only touches a
    // category whose override is a non-blank string (matching the old resolver's
    // blank-is-absent rule), and only the built-in ids can match (category_labels
    // keys were the fixed enum), so no user category is affected.
    const hasLabels = await tableExists(client, "category_labels");
    if (hasLabels) {
      await client.query(`
        UPDATE categories c
           SET label = cl.label
          FROM category_labels cl
         WHERE cl.kind = c.id
           AND btrim(cl.label) <> ''
      `);
    }

    // 4. Drop the entries.kind CHECK enum (kind is a data-table id now). Resolve
    // the real (auto-named) constraint from the catalog and DROP by that name; a
    // re-run finds none and is a no-op.
    await dropKindCheck(client);

    // 5. Retire category_labels. DROP IF EXISTS => idempotent. categories.label is
    // now the single source for header text.
    await client.query(`DROP TABLE IF EXISTS category_labels`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** True if a base table of this name exists in the current schema. */
async function tableExists(
  client: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> },
  table: string,
): Promise<boolean> {
  const res = await client.query(`SELECT to_regclass($1) AS reg`, [table]);
  return (res.rows[0] as { reg: string | null } | undefined)?.reg != null;
}

/**
 * Drop the CHECK constraint on entries.kind by its real (auto-generated) name.
 * The old inline `kind text NOT NULL CHECK (...)` is auto-named by Postgres, so
 * we resolve it from pg_constraint rather than hardcoding it: a CHECK ('c') on
 * entries whose single referenced column is `kind`. Returns the dropped name, or
 * null if it was already gone (idempotent re-run).
 */
async function dropKindCheck(client: {
  query: (t: string, p?: unknown[]) => Promise<{ rows: Array<{ conname: string }> }>;
}): Promise<string | null> {
  const res = await client.query(
    `SELECT c.conname
       FROM pg_constraint c
      WHERE c.conrelid = 'entries'::regclass
        AND c.contype = 'c'
        AND (
          SELECT array_agg(a.attname ORDER BY a.attname)
            FROM unnest(c.conkey) AS k(attnum)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ) = ARRAY['kind']::name[]`,
  );
  const name = res.rows[0]?.conname ?? null;
  if (name) {
    await client.query(`ALTER TABLE entries DROP CONSTRAINT "${name}"`);
  }
  return name;
}

async function main(): Promise<void> {
  loadEnv();
  await migrate();
  console.log(
    "[f9a-categories-expand] applied: categories table + 4 built-in seed, " +
      "category_labels folded into categories.label and dropped, entries.kind CHECK dropped.",
  );
  await closePool();
}

// Run only when invoked directly (npx tsx …/f9a-categories-expand.mts), never on
// import — so a test/verify harness can import { migrate } without the module
// self-executing against whatever DATABASE_URL happens to be set.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[f9a-categories-expand] failed:", err);
    await closePool();
    process.exit(1);
  });
}
