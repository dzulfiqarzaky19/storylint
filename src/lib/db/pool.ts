// Framework-free pg Pool singleton + typed query helpers.
// Reads process.env.DATABASE_URL. Kept free of Next/React so BE/FE can split later.
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

// dotenv is not a dependency; scripts load .env.local themselves (see loadEnv()).
// At runtime under Next, process.env.DATABASE_URL is already populated.

declare global {
  // Reuse the pool across HMR reloads in dev to avoid exhausting connections.
  // `var` is required to augment global scope in a `declare global` block.
  var __ashkeldPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Expected e.g. postgresql://ashkeld:ashkeld@localhost:5434/ashkeld",
    );
  }
  return new Pool({ connectionString });
}

export function getPool(): Pool {
  if (!global.__ashkeldPool) {
    global.__ashkeldPool = createPool();
  }
  return global.__ashkeldPool;
}

/** Parameterized query. Always pass values via `params` ($1, $2, ...); never interpolate. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

/** Convenience: return only the rows. */
export async function rows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}

/** Convenience: return the first row or null. */
export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const res = await query<T>(text, params);
  return res.rows[0] ?? null;
}

/** Run a set of statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (global.__ashkeldPool) {
    await global.__ashkeldPool.end();
    global.__ashkeldPool = undefined;
  }
}
