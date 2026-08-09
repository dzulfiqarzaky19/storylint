// tests/e2e/_helpers/db.ts — direct Postgres access for read-back assertions.
//
// UI state can lie; these helpers open a `pg` client on the SAME database the
// server under test uses and read rows back to prove a write truly landed.
// Playwright does not load `.env.local`, so `databaseUrl()` mirrors the app's
// tiny loader (src/lib/db/env.ts) to find DATABASE_URL.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

const DQUOTE = String.fromCharCode(34);
const SQUOTE = String.fromCharCode(39);

/** Resolve DATABASE_URL from the environment or, failing that, .env.local/.env. */
export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        if (line.slice(0, eq).trim() !== "DATABASE_URL") continue;
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith(DQUOTE) && value.endsWith(DQUOTE)) ||
          (value.startsWith(SQUOTE) && value.endsWith(SQUOTE))
        ) {
          value = value.slice(1, -1);
        }
        return value;
      }
    } catch {
      // File absent or unreadable; try the next candidate.
    }
  }
  throw new Error("DATABASE_URL not found in env or .env.local for read-back");
}

/** Open a client, run `fn`, and always close. Prefer `queryOne` for simple reads. */
export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** One-shot read: returns the first row (typed) or null. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  return withDb(async (client) => {
    const res = await client.query(sql, params);
    return (res.rows[0] as T) ?? null;
  });
}

/** Convenience: `SELECT count(*)` for `sql`, returned as a number. */
export async function countRows(
  table: string,
  where = "TRUE",
  params: unknown[] = [],
): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE ${where}`,
    params,
  );
  return Number(row?.n ?? "0");
}
