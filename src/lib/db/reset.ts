// Drops + recreates the schema from schema.sql. Destructive by design.
// Usage: npm run db:reset
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./env";
import { getPool, closePool } from "./pool";

export async function reset(): Promise<void> {
  const sql = readFileSync(resolve(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await getPool().query(sql);
}

async function main(): Promise<void> {
  loadEnv();
  await reset();
  console.log("[db:reset] schema recreated (12 tables).");
  await closePool();
}

// Run when invoked directly (tsx src/lib/db/reset.ts).
main().catch(async (err) => {
  console.error("[db:reset] failed:", err);
  await closePool();
  process.exit(1);
});
