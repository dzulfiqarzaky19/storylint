import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __storylintPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Expected e.g. postgresql://storylint:storylint@localhost:5434/storylint",
    );
  }
  return new Pool({ connectionString });
}

export function getPool(): Pool {
  if (!global.__storylintPool) {
    global.__storylintPool = createPool();
  }
  return global.__storylintPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

export async function rows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const res = await query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const res = await query<T>(text, params);
  return res.rows[0] ?? null;
}

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
  if (global.__storylintPool) {
    await global.__storylintPool.end();
    global.__storylintPool = undefined;
  }
}
