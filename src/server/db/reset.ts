import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "./env";
import { getPool, closePool } from "./pool";

export async function reset(): Promise<void> {
  const sql = readFileSync(resolve(process.cwd(), "src/server/db/schema.sql"), "utf8");
  await getPool().query(sql);
}

async function main(): Promise<void> {
  loadEnv();
  await reset();
  console.log("[db:reset] schema recreated.");
  await closePool();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    console.error("[db:reset] failed:", err);
    await closePool();
    process.exit(1);
  });
}
