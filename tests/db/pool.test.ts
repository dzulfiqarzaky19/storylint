import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { withTransaction } from "@/lib/db/pool";

// ---------------------------------------------------------------------------
// Validate the withTransaction integration boundary WITHOUT a real database.
// getPool() returns global.__ashkeldPool when it is already set, so we inject a
// fake pool whose connect() hands back a fake PoolClient that records every
// control statement (BEGIN / COMMIT / ROLLBACK) and whether it was released.
// This exercises the REAL withTransaction wiring that the research wipe depends
// on for its rollback guarantee -- non-destructively, no DATABASE_URL needed.
// ---------------------------------------------------------------------------

interface FakeClient {
  calls: string[];
  released: boolean;
  query(text: string): Promise<{ rows: never[] }>;
  release(): void;
}

function makeFakePool() {
  const client: FakeClient = {
    calls: [],
    released: false,
    async query(text: string) {
      client.calls.push(text);
      return { rows: [] };
    },
    release() {
      client.released = true;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  };
  return { pool, client };
}

// Snapshot + restore the global pool so we never touch a real connection and
// never leak our fake into another test file.
type PoolGlobal = { __ashkeldPool?: unknown };
const g = globalThis as unknown as PoolGlobal;
let saved: unknown;

beforeEach(() => {
  saved = g.__ashkeldPool;
});
afterEach(() => {
  g.__ashkeldPool = saved;
});

describe("withTransaction — the transaction boundary the research wipe relies on", () => {
  it("wraps a successful fn in BEGIN ... COMMIT and releases the client", async () => {
    const { pool, client } = makeFakePool();
    g.__ashkeldPool = pool;

    const result = await withTransaction(async (c) => {
      await c.query("SELECT 1");
      return "ok";
    });

    expect(result).toBe("ok");
    expect(client.calls).toEqual(["BEGIN", "SELECT 1", "COMMIT"]);
    expect(client.calls).not.toContain("ROLLBACK");
    expect(client.released).toBe(true);
  });

  it("issues ROLLBACK (not COMMIT) and RETHROWS when fn throws", async () => {
    const { pool, client } = makeFakePool();
    g.__ashkeldPool = pool;

    const boom = new Error("mid-transaction failure");
    await expect(
      withTransaction(async (c) => {
        await c.query("DELETE FROM research_turns");
        throw boom;
      }),
    ).rejects.toBe(boom);

    // This is the exact guarantee the wipe's protected-drift / mid-delete abort
    // depends on: a throw inside fn must roll back, never commit.
    expect(client.calls).toEqual([
      "BEGIN",
      "DELETE FROM research_turns",
      "ROLLBACK",
    ]);
    expect(client.calls).not.toContain("COMMIT");
    expect(client.released).toBe(true);
  });

  it("always releases the client, even on the rollback path", async () => {
    const { pool, client } = makeFakePool();
    g.__ashkeldPool = pool;

    await expect(
      withTransaction(async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");

    expect(client.released).toBe(true);
  });
});
