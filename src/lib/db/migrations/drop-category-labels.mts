// T-ARCH-1: drop leftover empty `category_labels`.
//
// F9-B (`f9a-categories-expand.mts`) already DROPs this table after folding
// overrides into `categories.label`. schema.sql has no leftover. Live :5434
// still carries the empty F6 table (0 rows) because that expand never ran
// against this clone. Idempotent DROP IF EXISTS; no rows, no FK, no app code.
//
// Apply: npx tsx src/lib/db/migrations/drop-category-labels.mts
import { loadEnv } from "../env";
import { getPool, closePool } from "../pool";

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DROP TABLE IF EXISTS category_labels`);
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
  console.log("[drop-category-labels] applied: leftover category_labels dropped.");
  await closePool();
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  main().catch(async (err) => {
    console.error("[drop-category-labels] failed:", err);
    await closePool();
    process.exit(1);
  });
}
